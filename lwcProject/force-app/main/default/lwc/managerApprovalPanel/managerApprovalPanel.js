import { LightningElement, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import getPendingApprovals from '@salesforce/apex/LeaveManagementController.getPendingApprovals';
import processLeaveRequest from '@salesforce/apex/LeaveManagementController.processLeaveRequest';

const ROW_ACTIONS = [
    { label: 'Approve', name: 'Approve' },
    { label: 'Reject', name: 'Reject' }
];

const COLUMNS = [
    { label: 'Request #', fieldName: 'Name' },
    { label: 'Employee', fieldName: 'employeeName' },
    { label: 'Type', fieldName: 'Leave_Type__c' },
    { label: 'Start Date', fieldName: 'Start_Date__c', type: 'date' },
    { label: 'End Date', fieldName: 'End_Date__c', type: 'date' },
    { label: 'Days', fieldName: 'Number_of_Days__c', type: 'number' },
    { type: 'action', typeAttributes: { rowActions: ROW_ACTIONS } }
];

export default class ManagerApprovalPanel extends LightningElement {
    columns = COLUMNS;
    rows = [];
    wiredApprovalsResult;

    @wire(getPendingApprovals)
    wiredApprovals(result) {
        this.wiredApprovalsResult = result;
        if (result.data) {
            this.rows = result.data.map((row) => ({
                ...row,
                employeeName: row.Employee__r?.Name
            }));
        }
    }

    get hasRows() {
        return this.rows.length > 0;
    }

    async handleRowAction(event) {
        const actionName = event.detail.action.name;
        const row = event.detail.row;
        const defaultComment = actionName === 'Approve' ? 'Approved by manager' : 'Rejected by manager';

        try {
            await processLeaveRequest({
                requestId: row.Id,
                action: actionName,
                managerComments: defaultComment
            });
            this.showToast('Success', `Request ${actionName.toLowerCase()}d successfully.`, 'success');
            await refreshApex(this.wiredApprovalsResult);
        } catch (error) {
            this.showToast('Error', error?.body?.message || 'Unable to process request.', 'error');
        }
    }

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title,
                message,
                variant
            })
        );
    }
}
