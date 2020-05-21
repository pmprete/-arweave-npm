import { and, equals } from 'arql-ops';
import fs from 'fs';
import path from 'path';

import ArweaveStorage from '../src/arweave-storage';
import Arweave from 'arweave/node';

import mockArweave from './__mocks__/Arweave';
import transaction from './__mocks__/Transaction';

const jwk = fs.readFileSync(path.join(__dirname, './__fixtures__/arweave-keyfile-jwk.json'), 'utf8');
let arweaveStorage: ArweaveStorage;

describe('Arweave Storage', () => {
    beforeEach(() => {
        arweaveStorage = new ArweaveStorage(mockArweave, jwk);
    });
  
    afterEach(() => {
        jest.clearAllMocks();
    });
  
    test('should create an instance', () => {
        expect(arweaveStorage).toBeDefined();
    });
  
    test('should runQuery', async () => {
        let txList = ['IFpLpXLbDaPMYjrTRe8r9Q0Nj2dVqdbZJKOYK8aD6sA','Lx0MKOXhwbM2gpCEPtAM5FfL4_cYDWIt8FsodPE566g'];
        let myQuery = and(
            equals('to', ''),
            equals('Source', 'NPM')
          );
        mockArweave.arql.mockResolvedValue(Promise.resolve(txList));

        const result = await arweaveStorage.runQuery(myQuery);

        expect(result).toBe(txList);
        expect(mockArweave.arql).toHaveBeenCalledTimes(1);
    });

    test('should getTransaction', async () => {
        mockArweave.transactions.get.mockResolvedValue(Promise.resolve(transaction));
        mockArweave.transactions.verify.mockResolvedValue(true);

        const result = await arweaveStorage.getTransaction('ITTPLYoxidZzAJP50FQ03QJUSkkh9iKHcmMcLZOvqtQ');

        expect(result).toBe(transaction);
    });

    test('should sendTransaction', async () => {
        mockArweave.transactions.get.mockResolvedValue(Promise.resolve(transaction));
        const response = {
            data: 'OK',
            status: 200,
            statusText: 'OK',
        };
        mockArweave.transactions.post.mockResolvedValue(Promise.resolve(response));
        mockArweave.transactions.getStatus.mockResolvedValue(Promise.resolve(response));

        const result = await arweaveStorage.sendTransaction(transaction);

        expect(result).toBe(response);
    });

    test('should createDataTransaction', async () => {
        mockArweave.createTransaction.mockResolvedValue(Promise.resolve(transaction));

        const result = await arweaveStorage.createDataTransaction('application/octet-stream', 'data to send', 'jquery','package.json');

        expect(result).toBeTruthy();
        expect(mockArweave.createTransaction).toHaveBeenCalledTimes(1);
    });

    test('should createDataTransaction with tags', async () => {
        mockArweave.createTransaction.mockResolvedValue(Promise.resolve(transaction));

        const result = await arweaveStorage.createDataTransaction('application/octet-stream', 'data to send', 'jquery','package.json', [['Package-Version', '2.1.4']]);

        expect(result).toBeTruthy();
        expect(mockArweave.createTransaction).toHaveBeenCalledTimes(1);
    });

    test('should getPackageTxByFileName', async () => {
        let txList = ['IFpLpXLbDaPMYjrTRe8r9Q0Nj2dVqdbZJKOYK8aD6sA','Lx0MKOXhwbM2gpCEPtAM5FfL4_cYDWIt8FsodPE566g'];
        mockArweave.arql.mockResolvedValue(Promise.resolve(txList));

        const result = await arweaveStorage.getPackageTxByFileName('jquery','package.json', 'XcWOdj_-QzjhuU4RnmzByfUqt89C19AG-xRHzXUOZBg');

        expect(result).toBe(txList);
    });

    test('should getAllPackagesHashes', async () => {
        let txList = ['IFpLpXLbDaPMYjrTRe8r9Q0Nj2dVqdbZJKOYK8aD6sA','Lx0MKOXhwbM2gpCEPtAM5FfL4_cYDWIt8FsodPE566g'];
        mockArweave.arql.mockResolvedValue(Promise.resolve(txList));

        const result = await arweaveStorage.getAllPackagesHashes('XcWOdj_-QzjhuU4RnmzByfUqt89C19AG-xRHzXUOZBg');
        expect(result[0]).toBe(txList[0]);
        expect(result[1]).toBe(txList[1]);
    });

});