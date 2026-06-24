trigger LeaveRequestTrigger on Leave_Request__c (before insert, before update) {
    LeaveRequestTriggerHandler.beforeSave(Trigger.new, Trigger.isInsert);
}
