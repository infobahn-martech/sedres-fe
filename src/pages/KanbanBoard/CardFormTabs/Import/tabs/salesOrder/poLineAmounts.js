/**
 * @param {object} item - a sales order line item (qty, unitPrice, discount, taxCode, totalAmount)
 */
export const calcLineAmounts = (item) => {
  const qty = parseFloat(item.qty) || 0;
  const unitPrice = parseFloat(item.unitPrice) || 0;
  const discount = parseFloat(item.discount) || 0;
  const taxRate = (parseFloat(String(item.taxCode || "0").replace(/%/g, "")) || 0) / 100;
  const subtotal = qty * unitPrice * (1 - discount / 100);
  const tax = subtotal * taxRate;
  const total = item.totalAmount ?? subtotal + tax;
  return { subtotal, tax, total };
};
