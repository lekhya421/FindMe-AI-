public with sharing class LeaveManagementController {
    private static final Decimal DEFAULT_ALLOCATION = 20;

    @AuraEnabled(cacheable=true)
    public static List<Leave_Balance__c> getMyLeaveBalances() {
        return [
            SELECT Id, Leave_Type__c, Total_Allocation__c, Used__c, Available__c
            FROM Leave_Balance__c
            WHERE Employee__c = :UserInfo.getUserId()
            ORDER BY Leave_Type__c
        ];
    }

    @AuraEnabled(cacheable=true)
    public static List<Leave_Request__c> getMyLeaveRequests() {
        return [
            SELECT Id, Name, Leave_Type__c, Start_Date__c, End_Date__c, Number_of_Days__c, Reason__c, Status__c, Manager_Comments__c, CreatedDate
            FROM Leave_Request__c
            WHERE Employee__c = :UserInfo.getUserId()
            ORDER BY CreatedDate DESC
        ];
    }

    @AuraEnabled
    public static Id applyLeave(String leaveType, Date startDate, Date endDate, String reason) {
        if (String.isBlank(leaveType) || startDate == null || endDate == null || String.isBlank(reason)) {
            throw new AuraHandledException('Leave type, dates, and reason are required.');
        }
        if (startDate > endDate) {
            throw new AuraHandledException('Start date must be before or equal to end date.');
        }

        User employee = [
            SELECT Id, Name, ManagerId, Manager.Email
            FROM User
            WHERE Id = :UserInfo.getUserId()
            LIMIT 1
        ];

        Decimal requestedDays = calculateLeaveDays(startDate, endDate);
        Leave_Balance__c balance = getOrCreateBalance(employee.Id, leaveType);

        if (leaveType != 'Unpaid' && balance.Available__c < requestedDays) {
            throw new AuraHandledException('Insufficient leave balance.');
        }

        Leave_Request__c requestRecord = new Leave_Request__c(
            Employee__c = employee.Id,
            Manager__c = employee.ManagerId,
            Leave_Type__c = leaveType,
            Start_Date__c = startDate,
            End_Date__c = endDate,
            Number_of_Days__c = requestedDays,
            Reason__c = reason,
            Status__c = 'Pending'
        );
        insert requestRecord;

        sendManagerNotification(employee, requestRecord);
        return requestRecord.Id;
    }

    @AuraEnabled(cacheable=true)
    public static List<Leave_Request__c> getPendingApprovals() {
        return [
            SELECT Id, Name, Employee__c, Employee__r.Name, Leave_Type__c, Start_Date__c, End_Date__c, Number_of_Days__c, Reason__c, Status__c
            FROM Leave_Request__c
            WHERE Manager__c = :UserInfo.getUserId() AND Status__c = 'Pending'
            ORDER BY CreatedDate DESC
        ];
    }

    @AuraEnabled
    public static void processLeaveRequest(Id requestId, String action, String managerComments) {
        if (requestId == null || String.isBlank(action)) {
            throw new AuraHandledException('Request and action are required.');
        }

        Leave_Request__c requestRecord = [
            SELECT Id, Employee__c, Manager__c, Leave_Type__c, Number_of_Days__c, Status__c
            FROM Leave_Request__c
            WHERE Id = :requestId
            LIMIT 1
        ];

        if (requestRecord.Manager__c != UserInfo.getUserId()) {
            throw new AuraHandledException('Only the assigned manager can process this request.');
        }
        if (requestRecord.Status__c != 'Pending') {
            throw new AuraHandledException('Only pending requests can be processed.');
        }

        if (action == 'Approve') {
            if (requestRecord.Leave_Type__c != 'Unpaid') {
                Leave_Balance__c balance = getOrCreateBalance(requestRecord.Employee__c, requestRecord.Leave_Type__c);
                if (balance.Available__c < requestRecord.Number_of_Days__c) {
                    throw new AuraHandledException('Employee has insufficient leave balance.');
                }
                balance.Used__c = (balance.Used__c == null ? 0 : balance.Used__c) + requestRecord.Number_of_Days__c;
                update balance;
            }
            requestRecord.Status__c = 'Approved';
        } else if (action == 'Reject') {
            requestRecord.Status__c = 'Rejected';
        } else {
            throw new AuraHandledException('Invalid action. Use Approve or Reject.');
        }

        requestRecord.Manager_Comments__c = managerComments;
        update requestRecord;
    }

    @AuraEnabled
    public static void withdrawLeaveRequest(Id requestId) {
        if (requestId == null) {
            throw new AuraHandledException('Request Id is required.');
        }

        Leave_Request__c requestRecord = [
            SELECT Id, Employee__c, Leave_Type__c, Number_of_Days__c, Status__c
            FROM Leave_Request__c
            WHERE Id = :requestId
            LIMIT 1
        ];

        if (requestRecord.Employee__c != UserInfo.getUserId()) {
            throw new AuraHandledException('Only the employee who submitted the request can withdraw it.');
        }

        if (requestRecord.Status__c != 'Pending' && requestRecord.Status__c != 'Approved') {
            throw new AuraHandledException('Only pending or approved requests can be withdrawn.');
        }

        if (requestRecord.Status__c == 'Approved' && requestRecord.Leave_Type__c != 'Unpaid') {
            Leave_Balance__c balance = getOrCreateBalance(requestRecord.Employee__c, requestRecord.Leave_Type__c);
            Decimal currentUsed = balance.Used__c == null ? 0 : balance.Used__c;
            Decimal daysToRestore = requestRecord.Number_of_Days__c == null ? 0 : requestRecord.Number_of_Days__c;
            balance.Used__c = currentUsed > daysToRestore ? currentUsed - daysToRestore : 0;
            update balance;
        }

        requestRecord.Status__c = 'Withdrawn';
        update requestRecord;
    }

    private static Decimal calculateLeaveDays(Date startDate, Date endDate) {
        return Decimal.valueOf(startDate.daysBetween(endDate) + 1);
    }

    private static Leave_Balance__c getOrCreateBalance(Id employeeId, String leaveType) {
        String key = employeeId + '-' + leaveType;

        List<Leave_Balance__c> existing = [
            SELECT Id, Employee__c, Leave_Type__c, Total_Allocation__c, Used__c, Available__c
            FROM Leave_Balance__c
            WHERE Balance_Key__c = :key
            LIMIT 1
        ];

        if (!existing.isEmpty()) {
            return existing[0];
        }

        Leave_Balance__c newBalance = new Leave_Balance__c(
            Name = 'Balance ' + leaveType,
            Employee__c = employeeId,
            Leave_Type__c = leaveType,
            Total_Allocation__c = leaveType == 'Unpaid' ? 0 : DEFAULT_ALLOCATION,
            Used__c = 0,
            Balance_Key__c = key
        );
        insert newBalance;
        return [
            SELECT Id, Employee__c, Leave_Type__c, Total_Allocation__c, Used__c, Available__c
            FROM Leave_Balance__c
            WHERE Id = :newBalance.Id
            LIMIT 1
        ];
    }

    private static void sendManagerNotification(User employee, Leave_Request__c requestRecord) {
        if (employee.ManagerId == null || employee.Manager == null || String.isBlank(employee.Manager.Email)) {
            return;
        }

        Messaging.SingleEmailMessage mail = new Messaging.SingleEmailMessage();
        mail.setToAddresses(new String[] { employee.Manager.Email });
        mail.setSubject('Leave approval required: ' + employee.Name);
        mail.setPlainTextBody(
            'A leave request is waiting for your action.' +
            '\nEmployee: ' + employee.Name +
            '\nType: ' + requestRecord.Leave_Type__c +
            '\nDates: ' + String.valueOf(requestRecord.Start_Date__c) + ' to ' + String.valueOf(requestRecord.End_Date__c) +
            '\nRequested Days: ' + String.valueOf(requestRecord.Number_of_Days__c)
        );
        Messaging.sendEmail(new Messaging.SingleEmailMessage[] { mail });
    }
}
