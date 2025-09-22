export const calculateAmountDue = (total, discount, paymentDetails) => {
    let amountPaid = 0;
    if (paymentDetails) {
        amountPaid = paymentDetails.reduce((sum, payment) => {
            const paidAmount = payment.amountPaid || 0;
            return sum + parseFloat(paidAmount);
        }, 0);
    }

    const discountAmount = total * (parseFloat(discount) / 100);
    const amountDue = total - (discountAmount + amountPaid);

    return amountDue;
};

export const calculateOrderTotal = (items) => {
    let total = 0;
    if (items) {
        total = items.reduce((sum, item) => {
            const price = (item.price || 0);
            return sum + parseFloat(price);
        }, 0);
    }
    return total;
};