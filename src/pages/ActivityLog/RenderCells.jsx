import moment from 'moment';

export const DateFormat = ({ row, selector }) => {
  const formattedDate = moment(row[selector]).format('DD/MM/YYYY hh:mm a');
  return formattedDate;
};

