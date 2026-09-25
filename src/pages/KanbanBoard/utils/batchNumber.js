const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Next batch number for today in the backend's format (Sep_26_Batch1), one past the highest
 * sequence already used today in `existingNumbers`.
 */
export const getNextBatchNumber = (existingNumbers = [], date = new Date()) => {
  const prefix = `${MONTHS[date.getMonth()]}_${String(date.getDate()).padStart(2, "0")}_Batch`;
  const highest = existingNumbers.reduce((max, batchNumber) => {
    const value = String(batchNumber ?? "");
    if (!value.startsWith(prefix)) return max;
    const seq = Number(value.slice(prefix.length));
    return Number.isInteger(seq) && seq > max ? seq : max;
  }, 0);
  return `${prefix}${highest + 1}`;
};

