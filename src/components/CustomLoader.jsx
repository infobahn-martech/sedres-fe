import CommonSkeleton from './CommonSkeleton';

export default function CustomLoader({ columns, limit = 10, Sl = false, expandable = false }) {
  const SKELETON_HEIGHT = 15; // Consistent height for all skeleton rows

  return (
    <tbody>
      {Array.from({ length: limit }).map((index, inx) => (
        <tr key={`${index}${inx}`}>
          {expandable && (
            <td className="custom-table-expand-cell">
              <CommonSkeleton height={SKELETON_HEIGHT} width={24} borderRadius={4} />
            </td>
          )}
          {Sl && (
            <td>
              <CommonSkeleton height={SKELETON_HEIGHT} width={40} />
            </td>
          )}
          {columns?.map(({ colClassName = '', selector, cell, contentClass }) => {
            // If it's an Actions column (has cell renderer), show two smaller skeletons
            if (cell && selector === 'linksInfo') {
              return (
                <td className={colClassName} key={`cell${selector}`}>
                  <div className={contentClass || 'actions'} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <CommonSkeleton height={SKELETON_HEIGHT} width={20} borderRadius={4} />
                    <CommonSkeleton height={SKELETON_HEIGHT} width={20} borderRadius={4} />
                  </div>
                </td>
              );
            }
            // For other columns, use full width skeleton
            return (
              <td className={colClassName} key={`cell${selector}`}>
                <CommonSkeleton height={SKELETON_HEIGHT} width="100%" />
              </td>
            );
          })}
        </tr>
      ))}
    </tbody>
  );
}
