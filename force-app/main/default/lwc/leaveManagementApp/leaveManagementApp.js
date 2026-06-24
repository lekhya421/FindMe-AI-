import { LightningElement } from 'lwc';

export default class LeaveManagementApp extends LightningElement {
    handleRequestSubmitted() {
        const history = this.template.querySelector('c-leave-history-dashboard');
        if (history) {
            history.refreshData();
        }
    }
}
