import Arweave from 'arweave/node';

const arweave: Arweave = {
    arql: jest.fn(),
    createTransaction: jest.fn(),
    createSiloTransaction: jest.fn(),
    getConfig: jest.fn(),
    transactions: {
        get: jest.fn(),
        getData: jest.fn(),
        sign: jest.fn(),
        verify: jest.fn(),
        post: jest.fn(),
        getPrice: jest.fn(),
        getTransactionAnchor: jest.fn(),
        fromRaw: jest.fn(),
        search: jest.fn(),
        getStatus: jest.fn(),
    },
    wallets: jest.fn(),
    api: jest.fn(),
    ar: jest.fn(),
    silo: jest.fn(),
    network: jest.fn(),
    crypto: jest.fn(),
    utils: jest.fn(),
  };
  export default arweave;