User me = [SELECT Id, Name, Username FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1];
System.debug('ME=' + me.Id + ' | ' + me.Username);
List<Leave_Request__c> reqs = [SELECT Id, Name, Employee__c, Manager__c, Status__c FROM Leave_Request__c ORDER BY CreatedDate DESC LIMIT 5];
for (Leave_Request__c r : reqs) {
    System.debug('REQ=' + r.Name + ' | Emp=' + r.Employee__c + ' | Mgr=' + r.Manager__c + ' | Status=' + r.Status__c);
}
