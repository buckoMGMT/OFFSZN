// Small "PG. 01" page-number label for top-right corner of each screen
export default function PageLabel({ number }) {
  return (
    <span className="page-number">PG. {String(number).padStart(2, "0")}</span>
  );
}