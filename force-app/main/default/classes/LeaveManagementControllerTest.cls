@IsTest
private class LeaveManagementControllerTest {
    @TestSetup
    static void setupData() {
        Profile profile = [SELECT Id FROM Profile WHERE UserType = 'Standard' LIMIT 1];

        User managerUser = new User(
            Alias = 'mgr01',
            Email = 'manager@testorg.com',
            EmailEncodingKey = 'UTF-8',
            LastName = 'Manager',
            LanguageLocaleKey = 'en_US',
            LocaleSidKey = 'en_US',
            ProfileId = profile.Id,
            TimeZoneSidKey = 'America/New_York',
            UserName = 'manager.' + System.currentTimeMillis() + '@testorg.com'
        );
        insert managerUser;

        User employeeUser = new User(
            Alias = 'emp01',
            Email = 'employee@testorg.com',
            EmailEncodingKey = 'UTF-8',
            LastName = 'Employee',
            LanguageLocaleKey = 'en_US',
            LocaleSidKey = 'en_US',
            ProfileId = profile.Id,
            TimeZoneSidKey = 'America/New_York',
            ManagerId = managerUser.Id,
            UserName = 'employee.' + System.currentTimeMillis() + '@testorg.com'
        );
        insert employeeUser;

        User otherUser = new User(
            Alias = 'oth01',
            Email = 'other@testorg.com',
            EmailEncodingKey = 'UTF-8',
            LastName = 'Other',
            LanguageLocaleKey = 'en_US',
            LocaleSidKey = 'en_US',
            ProfileId = profile.Id,
            TimeZoneSidKey = 'America/New_York',
            UserName = 'other.' + System.currentTimeMillis() + '@testorg.com'
        );
        insert otherUser;

        insert new Leave_Balance__c(
            Name = 'Employee Annual Balance',
            Employee__c = employeeUser.Id,
            Leave_Type__c = 'Annual',
            Total_Allocation__c = 20,
            Used__c = 0,
            Balance_Key__c = employeeUser.Id + '-Annual'
        );
    }

    @IsTest
    static void applyAndApproveLeaveFlow() {
        User employeeUser = [SELECT Id FROM User WHERE Alias = 'emp01' LIMIT 1];
        User managerUser = [SELECT Id FROM User WHERE Alias = 'mgr01' LIMIT 1];

        Id requestId;
        Test.startTest();
        System.runAs(employeeUser) {
            requestId = LeaveManagementController.applyLeave(
                'Annual',
                Date.today().addDays(5),
                Date.today().addDays(7),
                'Family event'
            );

            System.assertNotEquals(null, requestId);
            List<Leave_Request__c> myRequests = LeaveManagementController.getMyLeaveRequests();
            System.assertEquals(1, myRequests.size());
            System.assertEquals('Pending', myRequests[0].Status__c);
        }

        System.runAs(managerUser) {
            List<Leave_Request__c> pending = LeaveManagementController.getPendingApprovals();
            System.assertEquals(1, pending.size());
            LeaveManagementController.processLeaveRequest(requestId, 'Approve', 'Approved');
        }
        Test.stopTest();

        Leave_Request__c updatedRequest = [
            SELECT Status__c, Manager_Comments__c, Number_of_Days__c, Employee__c
            FROM Leave_Request__c
            WHERE Id = :requestId
            LIMIT 1
        ];
        System.assertEquals('Approved', updatedRequest.Status__c);
        System.assertEquals('Approved', updatedRequest.Manager_Comments__c);

        Leave_Balance__c updatedBalance = [
            SELECT Used__c
            FROM Leave_Balance__c
            WHERE Balance_Key__c = :updatedRequest.Employee__c + '-Annual'
            LIMIT 1
        ];
        System.assertEquals(updatedRequest.Number_of_Days__c, updatedBalance.Used__c);
    }

    @IsTest
    static void rejectAndTriggerDefaultFlow() {
        User employeeUser = [SELECT Id FROM User WHERE Alias = 'emp01' LIMIT 1];
        User managerUser = [SELECT Id FROM User WHERE Alias = 'mgr01' LIMIT 1];

        Id requestId;
        System.runAs(employeeUser) {
            // Trigger should backfill employee, manager, status and number of days.
            Leave_Request__c req = new Leave_Request__c(
                Leave_Type__c = 'Casual',
                Start_Date__c = Date.today().addDays(2),
                End_Date__c = Date.today().addDays(4),
                Reason__c = 'Personal errand'
            );
            insert req;
            requestId = req.Id;
        }

        Leave_Request__c insertedReq = [
            SELECT Employee__c, Manager__c, Status__c, Number_of_Days__c
            FROM Leave_Request__c
            WHERE Id = :requestId
            LIMIT 1
        ];
        System.assertEquals(employeeUser.Id, insertedReq.Employee__c);
        System.assertEquals(managerUser.Id, insertedReq.Manager__c);
        System.assertEquals('Pending', insertedReq.Status__c);
        System.assertEquals(3, insertedReq.Number_of_Days__c);

        System.runAs(managerUser) {
            LeaveManagementController.processLeaveRequest(requestId, 'Reject', 'Insufficient staffing');
        }

        Leave_Request__c rejectedReq = [
            SELECT Status__c, Manager_Comments__c
            FROM Leave_Request__c
            WHERE Id = :requestId
            LIMIT 1
        ];
        System.assertEquals('Rejected', rejectedReq.Status__c);
        System.assertEquals('Insufficient staffing', rejectedReq.Manager_Comments__c);
    }

    @IsTest
    static void errorPathsCoverage() {
        User employeeUser = [SELECT Id FROM User WHERE Alias = 'emp01' LIMIT 1];
        User managerUser = [SELECT Id FROM User WHERE Alias = 'mgr01' LIMIT 1];
        User otherUser = [SELECT Id FROM User WHERE Alias = 'oth01' LIMIT 1];

        System.runAs(employeeUser) {
            Boolean applyValidationThrown = false;
            try {
                LeaveManagementController.applyLeave('', null, null, '');
            } catch (AuraHandledException ex) {
                applyValidationThrown = true;
            }
            System.assertEquals(true, applyValidationThrown);

            Boolean insufficientThrown = false;
            try {
                LeaveManagementController.applyLeave(
                    'Annual',
                    Date.today().addDays(1),
                    Date.today().addDays(30),
                    'Long vacation'
                );
            } catch (AuraHandledException ex) {
                insufficientThrown = true;
            }
            System.assertEquals(true, insufficientThrown);
        }

        Id pendingRequestId;
        System.runAs(employeeUser) {
            pendingRequestId = LeaveManagementController.applyLeave(
                'Sick',
                Date.today().addDays(10),
                Date.today().addDays(10),
                'Doctor appointment'
            );
            List<Leave_Balance__c> balances = LeaveManagementController.getMyLeaveBalances();
            System.assert(balances.size() > 0);
        }

        System.runAs(otherUser) {
            Boolean unauthorizedThrown = false;
            try {
                LeaveManagementController.processLeaveRequest(pendingRequestId, 'Approve', 'N/A');
            } catch (AuraHandledException ex) {
                unauthorizedThrown = true;
            }
            System.assertEquals(true, unauthorizedThrown);
        }

        System.runAs(managerUser) {
            Boolean invalidActionThrown = false;
            try {
                LeaveManagementController.processLeaveRequest(pendingRequestId, 'Hold', 'N/A');
            } catch (AuraHandledException ex) {
                invalidActionThrown = true;
            }
            System.assertEquals(true, invalidActionThrown);
        }
    }

    @IsTest
    static void withdrawLeaveFlow() {
        User employeeUser = [SELECT Id FROM User WHERE Alias = 'emp01' LIMIT 1];
        User managerUser = [SELECT Id FROM User WHERE Alias = 'mgr01' LIMIT 1];
        User otherUser = [SELECT Id FROM User WHERE Alias = 'oth01' LIMIT 1];

        Id pendingRequestId;
        System.runAs(employeeUser) {
            pendingRequestId = LeaveManagementController.applyLeave(
                'Casual',
                Date.today().addDays(1),
                Date.today().addDays(1),
                'Need a day off'
            );
        }

        System.runAs(otherUser) {
            Boolean unauthorizedWithdrawThrown = false;
            try {
                LeaveManagementController.withdrawLeaveRequest(pendingRequestId);
            } catch (AuraHandledException ex) {
                unauthorizedWithdrawThrown = true;
            }
            System.assertEquals(true, unauthorizedWithdrawThrown);
        }

        System.runAs(employeeUser) {
            LeaveManagementController.withdrawLeaveRequest(pendingRequestId);
        }

        Leave_Request__c withdrawnReq = [
            SELECT Status__c
            FROM Leave_Request__c
            WHERE Id = :pendingRequestId
            LIMIT 1
        ];
        System.assertEquals('Withdrawn', withdrawnReq.Status__c);

        Id approvedRequestId;
        Decimal approvedDays;
        System.runAs(employeeUser) {
            approvedRequestId = LeaveManagementController.applyLeave(
                'Annual',
                Date.today().addDays(15),
                Date.today().addDays(16),
                'Trip'
            );
        }

        System.runAs(managerUser) {
            LeaveManagementController.processLeaveRequest(approvedRequestId, 'Approve', 'Approved for trip');
        }

        Leave_Request__c approvedReq = [
            SELECT Employee__c, Number_of_Days__c, Status__c
            FROM Leave_Request__c
            WHERE Id = :approvedRequestId
            LIMIT 1
        ];
        approvedDays = approvedReq.Number_of_Days__c;
        System.assertEquals('Approved', approvedReq.Status__c);

        Leave_Balance__c balanceAfterApproval = [
            SELECT Used__c
            FROM Leave_Balance__c
            WHERE Balance_Key__c = :approvedReq.Employee__c + '-Annual'
            LIMIT 1
        ];
        System.assertEquals(approvedDays, balanceAfterApproval.Used__c);

        System.runAs(employeeUser) {
            LeaveManagementController.withdrawLeaveRequest(approvedRequestId);
        }

        Leave_Request__c withdrawnApprovedReq = [
            SELECT Status__c
            FROM Leave_Request__c
            WHERE Id = :approvedRequestId
            LIMIT 1
        ];
        System.assertEquals('Withdrawn', withdrawnApprovedReq.Status__c);

        Leave_Balance__c balanceAfterWithdraw = [
            SELECT Used__c
            FROM Leave_Balance__c
            WHERE Balance_Key__c = :approvedReq.Employee__c + '-Annual'
            LIMIT 1
        ];
        System.assertEquals(0, balanceAfterWithdraw.Used__c);

        Id rejectedRequestId;
        System.runAs(employeeUser) {
            rejectedRequestId = LeaveManagementController.applyLeave(
                'Casual',
                Date.today().addDays(20),
                Date.today().addDays(20),
                'Errand'
            );
        }

        System.runAs(managerUser) {
            LeaveManagementController.processLeaveRequest(rejectedRequestId, 'Reject', 'Cannot approve');
        }

        System.runAs(employeeUser) {
            Boolean invalidStatusThrown = false;
            try {
                LeaveManagementController.withdrawLeaveRequest(rejectedRequestId);
            } catch (AuraHandledException ex) {
                invalidStatusThrown = true;
            }
            System.assertEquals(true, invalidStatusThrown);
        }
    }
}
