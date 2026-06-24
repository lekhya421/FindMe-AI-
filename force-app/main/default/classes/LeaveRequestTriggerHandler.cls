public with sharing class LeaveRequestTriggerHandler {
    public static void beforeSave(List<Leave_Request__c> newRecords, Boolean isInsert) {
        Set<Id> employeeIds = new Set<Id>();

        for (Leave_Request__c req : newRecords) {
            if (req.Start_Date__c != null && req.End_Date__c != null && req.End_Date__c >= req.Start_Date__c) {
                req.Number_of_Days__c = Decimal.valueOf(req.Start_Date__c.daysBetween(req.End_Date__c) + 1);
            }

            if (isInsert) {
                if (req.Employee__c == null) {
                    req.Employee__c = UserInfo.getUserId();
                }
                if (String.isBlank(req.Status__c)) {
                    req.Status__c = 'Pending';
                }
            }

            if (req.Employee__c != null && req.Manager__c == null) {
                employeeIds.add(req.Employee__c);
            }
        }

        if (employeeIds.isEmpty()) {
            return;
        }

        Map<Id, User> usersById = new Map<Id, User>([
            SELECT Id, ManagerId
            FROM User
            WHERE Id IN :employeeIds
        ]);

        for (Leave_Request__c req : newRecords) {
            if (req.Employee__c != null && req.Manager__c == null && usersById.containsKey(req.Employee__c)) {
                req.Manager__c = usersById.get(req.Employee__c).ManagerId;
            }
        }
    }
}
