// Previously verified DOCO live records. Explicit identities prevent imported
// copies with the same names/SKUs/amounts from silently changing new purchases.
// These are public Stripe object IDs, not credentials. Update intentionally
// after verifying replacement records; never fall back to a same-name product.
export const LIVE_CATALOG = {
  multi: {
    once: ['prod_VRTbzxW81tWVCS', 'price_1UQaeFG2IwfaSIOPzHHtYIZI'],
    sub: ['prod_VWHnLVgTfPHn1c', 'price_1UVFDxG2IwfaSIOPGboDTe9K'],
  },
  sport: {
    once: ['prod_VRTaJBRcWSjb8O', 'price_1UQadLG2IwfaSIOP37eij2YR'],
    sub: ['prod_VWHoOUwpJQMPzP', 'price_1UVFEOG2IwfaSIOPIx8Ycp19'],
  },
  calm: {
    once: ['prod_VRTZeS5QC9cZyu', 'price_1UQaciG2IwfaSIOPDMb3ULWk'],
    sub: ['prod_VWHoeo1XqbDOUv', 'price_1UVFEmG2IwfaSIOPATuVpzcH'],
  },
  sleep: {
    once: ['prod_VRTVnXE4AWtwMA', 'price_1UQaYpG2IwfaSIOPCEsJcvyd'],
    sub: ['prod_VWHoRGpIaI8pIi', 'price_1UVFF3G2IwfaSIOP56O6lkkj'],
  },
  'duo-domore': {
    once: ['prod_VWHptSy4JBV0OE', 'price_1UVFG0G2IwfaSIOPllmYHHmG'],
    sub: ['prod_VWHpiZzjz8YGGQ', 'price_1UVFGHG2IwfaSIOPKOJ3sdiZ'],
  },
  'duo-relax': {
    once: ['prod_VWHqRuzzK9AsG2', 'price_1UVFGxG2IwfaSIOPLfRLWL2k'],
    sub: ['prod_VWHrUYWq9G1MBP', 'price_1UVFHXG2IwfaSIOPIyDVkqBU'],
  },
  stack: {
    once: ['prod_VWHrGFwiXaFqy7', 'price_1UVFI4G2IwfaSIOPMIVR4cka'],
    sub: ['prod_VWHs66slkeiuf3', 'price_1UVFIRG2IwfaSIOPBwhG0zZn'],
  },
  _shipping: {
    once: ['prod_VWHu4YtaF5nqJo', 'price_1UVFKsG2IwfaSIOP4HJxdSjD'],
    sub: ['prod_VWHu4YtaF5nqJo', 'price_1UVFKsG2IwfaSIOPVGmijRUA'],
  },
};
