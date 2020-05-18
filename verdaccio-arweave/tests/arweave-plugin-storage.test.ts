import { PluginOptions } from '@verdaccio/types';
import { ArweaveConfig } from '../types';

import ArweavePackageManager from '../src/arweave-package-manager';
import ArweavePluginStorage from '../src/arweave-plugin-storage';

import Config from './__mocks__/Config';
import logger from './__mocks__/Logger';

const optionsPlugin: PluginOptions<ArweaveConfig> = {
  logger,
  config: new Config(),
};

let arweavePluginStorage: ArweavePluginStorage;

describe('Arweave Plugin Storage', () => {
  beforeEach(() => {
    arweavePluginStorage = new ArweavePluginStorage(optionsPlugin.config, optionsPlugin);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should create an instance', () => {
    expect(optionsPlugin.logger.error).not.toHaveBeenCalled();
    expect(arweavePluginStorage).toBeDefined();
  });

  describe('should create set secret', () => {
    test('should create get secret', async () => {
      const secretKey = await arweavePluginStorage.getSecret();

      expect(secretKey).toBeDefined();
      expect(typeof secretKey === 'string').toBeTruthy();
    });

    test('should create set secret', async () => {
      await arweavePluginStorage.setSecret(optionsPlugin.config.checkSecretKey(''));

      expect(optionsPlugin.config.secret).toBeDefined();
      expect(typeof optionsPlugin.config.secret === 'string').toBeTruthy();

      const fetchedSecretKey = await arweavePluginStorage.getSecret();
      expect(optionsPlugin.config.secret).toBe(fetchedSecretKey);
    });
  });

  describe('getPackageStorage', () => {
    test('should get default storage (all addresses)', () => {
      const pkgName = 'someRandomePackage';
      const arweavePackageManager = arweavePluginStorage.getPackageStorage(pkgName);
      expect(arweavePackageManager).toBeDefined();

      if (arweavePackageManager) {
        const address = (arweavePackageManager as ArweavePackageManager).storageAddress;
        expect(address).toBe(undefined);
      }
    });

    test('should use custom storage (only from designated address)', () => {
      const pkgName = 'local-private-custom-storage';
      const arweavePackageManager = arweavePluginStorage.getPackageStorage(pkgName);
      expect(arweavePackageManager).toBeDefined();

      if (arweavePackageManager) {
        const address = (arweavePackageManager as ArweavePackageManager).storageAddress;
        expect(address).toBe('private_address');
      }
    });
  });

  describe('Database CRUD', () => {
    const mockGetAllPackages = jest.fn();
    const mockGetPackageTxByFileName = jest.fn();
    const mockSendTransaction = jest.fn();
    const mockArweaveStorage = { 
      getAllPackages: mockGetAllPackages,
      getPackageTxByFileName: mockGetPackageTxByFileName,
      createDataTransaction: jest.fn(),
      sendTransaction: mockSendTransaction,
      getTransaction: jest.fn(),
      runQuery: jest.fn(),
      arweave: jest.fn(),
      jwk: jest.fn()
    };

    test('should add an item to database', done => {
      const pgkName = 'jquery';
      arweavePluginStorage.arweaveStorage = mockArweaveStorage;

      mockGetAllPackages.mockReturnValueOnce(Promise.resolve([]));
      arweavePluginStorage.get((err, data) => {
        expect(err).toBeNull();
        expect(data).toHaveLength(0);
        mockGetPackageTxByFileName.mockReturnValueOnce(Promise.resolve([]));
        mockSendTransaction.mockReturnValueOnce(Promise.resolve({status:200}));
        arweavePluginStorage.add(pgkName, err => {
          expect(err).toBeNull();

          mockGetAllPackages.mockReturnValueOnce(Promise.resolve([pgkName]));

          arweavePluginStorage.get((err, data) => {
            expect(err).toBeNull();
            expect(data).toHaveLength(1);
            done();
          });
        });
      });
    });

    test('should fail toremove an item to arweave', done => {
      const pgkName = 'jquery';
      arweavePluginStorage.remove(pgkName, err => {
        expect(err).toBeTruthy();
        done();
      });
    });
  });

  describe('should test non implemented methods', () => {
    const warn = jest.fn();
    const optionsPluginWarn: PluginOptions<ArweaveConfig> = {
      logger: { ...logger, warn },
      config: new Config(),
    };
    beforeEach(() => {
      arweavePluginStorage = new ArweavePluginStorage(optionsPlugin.config, optionsPluginWarn);
    });

    test('should test saveToken', done => {
      arweavePluginStorage.saveToken(jest.fn()).catch((err) => {
        expect(err).toBeTruthy();
        expect(warn).toHaveBeenCalled();
        done();
      });
    });

    test('should test deleteToken', done => {
      arweavePluginStorage.deleteToken('','').catch((err) => {
        expect(err).toBeTruthy();
        expect(warn).toHaveBeenCalled();
        done();
      });
    });

    test('should test readTokens', done => {
      arweavePluginStorage.readTokens(jest.fn()).catch((err) => {
        expect(err).toBeTruthy();
        expect(warn).toHaveBeenCalled();
        done();
      });
    });

    test('should test search', done => {
      arweavePluginStorage.search(null, (err) => {
        expect(err).toBeTruthy();
        expect(warn).toHaveBeenCalled();
        done();
      }, null);
    });
  });

});