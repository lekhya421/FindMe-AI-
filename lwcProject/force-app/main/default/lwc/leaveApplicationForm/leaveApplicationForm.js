import { LightningElement } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import applyLeave from '@salesforce/apex/LeaveManagementController.applyLeave';

export default class LeaveApplicationForm extends LightningElement {
    leaveType = 'Annual';
    startDate;
    endDate;
    reason;
    isSubmitting = false;

    leaveTypeOptions = [
        { label: 'Annual', value: 'Annual' },
        { label: 'Sick', value: 'Sick' },
        { label: 'Casual', value: 'Casual' },
        { label: 'Unpaid', value: 'Unpaid' }
    ];

    handleChange(event) {
        this[event.target.dataset.field] = event.target.value;
    }

    async handleSubmit() {
        if (!this.leaveType || !this.startDate || !this.endDate || !this.reason) {
            this.showToast('Missing details', 'Please fill all fields before submitting.', 'error');
            return;
        }

        this.isSubmitting = true;
        try {
            await applyLeave({
                leaveType: this.leaveType,
                startDate: this.startDate,
                endDate: this.endDate,
                reason: this.reason
            });

            this.startDate = null;
            this.endDate = null;
            this.reason = null;
            this.showToast('Success', 'Leave request submitted.', 'success');

            this.dispatchEvent(new CustomEvent('requestsubmitted'));
        } catch (error) {
            this.showToast('Error', error?.body?.message || 'Unable to submit leave request.', 'error');
        } finally {
            this.isSubmitting = false;
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
