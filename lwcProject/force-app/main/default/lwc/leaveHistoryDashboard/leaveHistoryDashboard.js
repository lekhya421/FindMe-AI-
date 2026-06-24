import { LightningElement, api, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import getMyLeaveRequests from '@salesforce/apex/LeaveManagementController.getMyLeaveRequests';
import getMyLeaveBalances from '@salesforce/apex/LeaveManagementController.getMyLeaveBalances';
import withdrawLeaveRequest from '@salesforce/apex/LeaveManagementController.withdrawLeaveRequest';

const ROW_ACTIONS = [{ label: 'Withdraw', name: 'Withdraw' }];

const COLUMNS = [
    { label: 'Request #', fieldName: 'Name' },
    { label: 'Type', fieldName: 'Leave_Type__c' },
    { label: 'Start Date', fieldName: 'Start_Date__c', type: 'date' },
    { label: 'End Date', fieldName: 'End_Date__c', type: 'date' },
    { label: 'Days', fieldName: 'Number_of_Days__c', type: 'number' },
    { label: 'Status', fieldName: 'Status__c' },
    { type: 'action', typeAttributes: { rowActions: ROW_ACTIONS } }
];

const BALANCE_COLUMNS = [
    { label: 'Type', fieldName: 'Leave_Type__c' },
    { label: 'Total', fieldName: 'Total_Allocation__c', type: 'number' },
    { label: 'Used', fieldName: 'Used__c', type: 'number' },
    { label: 'Available', fieldName: 'Available__c', type: 'number' }
];

export default class LeaveHistoryDashboard extends LightningElement {
    columns = COLUMNS;
    balanceColumns = BALANCE_COLUMNS;
    rows = [];
    balances = [];
    wiredRequestsResult;
    wiredBalancesResult;

    @wire(getMyLeaveRequests)
    wiredRequests(result) {
        this.wiredRequestsResult = result;
        if (result.data) {
            this.rows = result.data;
        }
    }

    @wire(getMyLeaveBalances)
    wiredBalances(result) {
        this.wiredBalancesResult = result;
        if (result.data) {
            this.balances = result.data;
        }
    }

    get hasRows() {
        return this.rows.length > 0;
    }

    get hasBalances() {
        return this.balances.length > 0;
    }

    async handleRowAction(event) {
        const actionName = event.detail.action.name;
        const row = event.detail.row;

        if (actionName !== 'Withdraw') {
            return;
        }

        if (row.Status__c !== 'Pending' && row.Status__c !== 'Approved') {
            this.showToast('Cannot withdraw', 'Only pending or approved requests can be withdrawn.', 'warning');
            return;
        }

        try {
            await withdrawLeaveRequest({ requestId: row.Id });
            this.showToast('Success', 'Leave request withdrawn.', 'success');
            await this.refreshData();
        } catch (error) {
            this.showToast('Error', error?.body?.message || 'Unable to withdraw request.', 'error');
        }
    }

    @api
    refreshData() {
        const refreshJobs = [];
        if (this.wiredRequestsResult) {
            refreshJobs.push(refreshApex(this.wiredRequestsResult));
        }
        if (this.wiredBalancesResult) {
            refreshJobs.push(refreshApex(this.wiredBalancesResult));
        }
        return Promise.all(refreshJobs);
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
