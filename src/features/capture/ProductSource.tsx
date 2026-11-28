export function ProductSource({ barcode }: { barcode?: string }) {
  return (
    <small className="product-source">
      <a
        href={
          'https://world.openfoodfacts.org/' +
          (barcode ? 'product/' + barcode : '')
        }
        rel="noreferrer"
        target="_blank"
      >
        Produktdaten von Open Food Facts
      </a>
      {' · '}
      <a
        href="https://opendatacommons.org/licenses/odbl/1-0/"
        rel="noreferrer"
        target="_blank"
      >
        ODbL
      </a>
    </small>
  );
}
