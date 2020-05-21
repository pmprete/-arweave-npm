import path from 'path';
import fs from 'fs';

import ArweavePackageManager from '../src/arweave-package-manager';
import ArweaveStorage from '../src/arweave-storage';

import { generatePackage } from './__fixtures__/utils.helper';
import { API_ERROR, VerdaccioError } from '@verdaccio/commons-api';

import logger from './__mocks__/Logger';
import { MemoryLocalStorage } from '../src/arweave-plugin-storage';
const pkgFileName = 'package.json';

jest.mock('../src/arweave-storage'); // ArweaveStorage is now a mock constructor

beforeAll(() => {
  // Clear all instances and calls to constructor and all methods:
  ArweaveStorage.mockClear();
});

function _createEmtpyDatabase(): MemoryLocalStorage {
  const list: string[] = [];
  const files = {};
  const txHashList = {};
  const emptyDatabase = {
    list,
    txHashList,
    files,
    secret: '',
  };

  return emptyDatabase;
}

describe('Arweave Package Manager test', () => {
  describe('savePackage() group', () => {
    test('savePackage()', done => {
      const pkgName = 'savePkg1';
      const pkg = generatePackage(pkgName);
      const mockArweaveStorage = new ArweaveStorage();
      mockArweaveStorage.createDataTransaction.mockResolvedValue({id:'_MwkprJymcH-rB9doHh3zZqCQu4HAN_xMxkjQ2N3O9s'});
      mockArweaveStorage.sendTransaction.mockResolvedValue({status:200, });

      const arweavePagckageManager = new ArweavePackageManager(pkgName, logger, mockArweaveStorage, _createEmtpyDatabase(), undefined);

      arweavePagckageManager.savePackage('pkg.1.0.0.tar.gz', pkg, err => {
        expect(err).toBeNull();
        expect(mockArweaveStorage.createDataTransaction).toHaveBeenCalledTimes(1);
        expect(mockArweaveStorage.sendTransaction).toHaveBeenCalledTimes(1);
        done();
      });
    });
  });

  describe('readPackage() group', () => {
    test('readPackage() success', done => {
        const pkgName = 'readme-test';
        const pkgJson = fs.readFileSync(path.join(__dirname,'./__fixtures__/readme-test/package.json'));
        const mockArweaveStorage = new ArweaveStorage();
        mockArweaveStorage.getPackageTxByFileName.mockResolvedValue(['hKMMPNh_emBf8v_at1tFzNYACisyMQNcKzeeE1QE9p8']);
        //const mockTransaction = { get: jest.fn(()=> pkgJson)} ;
        mockArweaveStorage.getTransactionData.mockResolvedValue(pkgJson)//mockTransaction);

        const arweavePagckageManager = new ArweavePackageManager(pkgName, logger, mockArweaveStorage, _createEmtpyDatabase(), undefined);

        arweavePagckageManager.readPackage(pkgFileName, err => {
            expect(err).toBeNull();
            expect(mockArweaveStorage.getPackageTxByFileName).toHaveBeenCalledTimes(1);
            expect(mockArweaveStorage.getTransactionData).toHaveBeenCalledTimes(1);
            done();
        });
    });

    test('readPackage() fails', done => {
        const pkgName = 'readme-test';
        const mockArweaveStorage = new ArweaveStorage();
        mockArweaveStorage.getPackageTxByFileName.mockResolvedValue([]);

        const arweavePagckageManager = new ArweavePackageManager(pkgName, logger, mockArweaveStorage, _createEmtpyDatabase(), undefined);

        arweavePagckageManager.readPackage(pkgFileName, err => {
            expect(err).toBeTruthy();
            expect(mockArweaveStorage.getPackageTxByFileName).toHaveBeenCalledTimes(1);
            expect(mockArweaveStorage.getTransactionData).toHaveBeenCalledTimes(0);
            done();
        });
    });

    test('readPackage() fails corrupt', done => {
        const pkgName = 'readme-test';
        const mockArweaveStorage = new ArweaveStorage();
        mockArweaveStorage.getPackageTxByFileName.mockResolvedValue(['hKMMPNh_emBf8v_at1tFzNYACisyMQNcKzeeE1QE9p8']);
        const mockTransaction = { get: ()=>{throw new Error('transaction validation failed') }} ;
        mockArweaveStorage.getTransactionData.mockResolvedValue(mockTransaction);

        let cache = _createEmtpyDatabase();
        const arweavePagckageManager = new ArweavePackageManager(pkgName, logger, mockArweaveStorage, cache, undefined);

        arweavePagckageManager.readPackage(pkgFileName, err => {
            expect(err).toBeTruthy();
            expect(mockArweaveStorage.getPackageTxByFileName).toHaveBeenCalledTimes(1);
            expect(mockArweaveStorage.getTransactionData).toHaveBeenCalledTimes(1);
            done();
        });
    });
  });

  describe('createPackage() group', () => {
    test('createPackage()', done => {
        const pkgName = 'createPackage';
        const pkg = generatePackage('createPackage');
        const mockArweaveStorage = new ArweaveStorage();
        //mockArweaveStorage.createDataTransaction.mockResolvedValue({id:'_MwkprJymcH-rB9doHh3zZqCQu4HAN_xMxkjQ2N3O9s'});
        mockArweaveStorage.getPackageTxByFileNameAndVersion.mockResolvedValue([]);
        //mockArweaveStorage.sendTransaction.mockResolvedValue({status:200});

        let cache = _createEmtpyDatabase();
        const arweavePagckageManager = new ArweavePackageManager(pkgName, logger, mockArweaveStorage, cache, undefined);

        arweavePagckageManager.createPackage(pkgName, pkg, err => {
            expect(err).toBeNull();
            expect(cache.files[pkgName]).toBe(pkg);
            // expect(mockArweaveStorage.createDataTransaction).toHaveBeenCalledTimes(1);
            // expect(mockArweaveStorage.sendTransaction).toHaveBeenCalledTimes(1);
            done();
        });
    });

    test('createPackage() fails by fileExist', done => {
        const pkgName = 'createPackage';
        const pkg = generatePackage('createPackage');
        const mockArweaveStorage = new ArweaveStorage();
        //mockArweaveStorage.createDataTransaction.mockResolvedValue({id:'_MwkprJymcH-rB9doHh3zZqCQu4HAN_xMxkjQ2N3O9s'});
        mockArweaveStorage.getPackageTxByFileNameAndVersion.mockResolvedValue([]);
        //mockArweaveStorage.sendTransaction.mockResolvedValue({status:200});

        let cache = _createEmtpyDatabase();
        const arweavePagckageManager = new ArweavePackageManager(pkgName, logger, mockArweaveStorage, cache, undefined);

        arweavePagckageManager.createPackage(pkgName, pkg, err => {
            expect(err).toBeTruthy();
            expect(cache.files[pkgName]).toBe(pkg);
            // expect(mockArweaveStorage.createDataTransaction).toHaveBeenCalledTimes(1);
            // expect(mockArweaveStorage.sendTransaction).toHaveBeenCalledTimes(1);
            done();
        });

    });

    describe('deletePackage() group', () => {
      test('deletePackage()', done => {
        const mockArweaveStorage = new ArweaveStorage();
        // verdaccio removes the package.json instead the package name
        const pkgName = 'package.json';
        const arweavePagckageManager = new ArweavePackageManager(pkgName, logger, mockArweaveStorage, _createEmtpyDatabase(), undefined);
        
        arweavePagckageManager.deletePackage(pkgName, err => {
          expect(err).toBeTruthy();
          done();
        });
      });
    });
  });

  describe('removePackage() group', () => {
    test('removePackage()', done => {
        const mockArweaveStorage = new ArweaveStorage();
        const pkgName = 'remove-package';
        const arweavePagckageManager = new ArweavePackageManager(pkgName, logger, mockArweaveStorage, _createEmtpyDatabase(), undefined);

        arweavePagckageManager.removePackage(error => {
            expect(error).toBeTruthy();
            done();
        });
    });
  });

  describe('readTarball() group', () => {
    test('readTarball() success', done => {
        const pkgName = 'readme-test';
        let pkgTarball = fs.readFileSync(path.join(__dirname,'./__fixtures__/readme-test/test-readme-0.0.0.tgz'));
        const mockArweaveStorage = new ArweaveStorage();
        mockArweaveStorage.getPackageTxByFileName.mockResolvedValue(['hKMMPNh_emBf8v_at1tFzNYACisyMQNcKzeeE1QE9p8']);
        const mockTransaction = { get: jest.fn(()=> pkgTarball)} ;
        mockArweaveStorage.getTransaction.mockResolvedValue(mockTransaction);

        const arweavePagckageManager = new ArweavePackageManager(pkgName, logger, mockArweaveStorage, _createEmtpyDatabase(), undefined);

        const readTarballStream = arweavePagckageManager.readTarball('test-readme-0.0.0.tgz');

        readTarballStream.on('error', function (err) {
            expect(err).toBeNull();
        });

        readTarballStream.on('content-length', function (content) {
            expect(content).toBe(352);
        });

        readTarballStream.on('end', function () {
            expect(mockArweaveStorage.getPackageTxByFileName).toHaveBeenCalledTimes(1);
            expect(mockArweaveStorage.getTransaction).toHaveBeenCalledTimes(1);
            done();
        });

        readTarballStream.on('data', function (data) {
            expect(data).toBeDefined();
        });
    });

    test('readTarball() fails', done => {
        const pkgName = 'readme-test';
        const mockArweaveStorage = new ArweaveStorage();
        mockArweaveStorage.getPackageTxByFileName.mockResolvedValue([]);

        const arweavePagckageManager = new ArweavePackageManager(pkgName, logger, mockArweaveStorage, _createEmtpyDatabase(), undefined);
        const readTarballStream = arweavePagckageManager.readTarball('file-does-not-exist0.0.0.tgz');

        readTarballStream.on('error', function (err) {
            expect(err).toBeTruthy();
            done();
        });
    });
  });

  describe('writeTarball() group', () => {
    test('writeTarball() success', done => {
        const pkgName = 'readme-test';
        const newFileName = 'new-readme-0.0.0.tgz';
        const readTarballStream = fs.createReadStream(path.join(__dirname,'./__fixtures__/readme-test/test-readme-0.0.0.tgz'));

        const mockArweaveStorage = new ArweaveStorage();
        mockArweaveStorage.getPackageTxByFileName.mockResolvedValue([]);
        mockArweaveStorage.createDataTransaction.mockResolvedValue({id:'_MwkprJymcH-rB9doHh3zZqCQu4HAN_xMxkjQ2N3O9s'});
        mockArweaveStorage.sendTransaction.mockResolvedValue({status:200});

        const arweavePagckageManager = new ArweavePackageManager(pkgName, logger, mockArweaveStorage, _createEmtpyDatabase(), undefined);
        const writeTarballStream = arweavePagckageManager.writeTarball(newFileName);

        writeTarballStream.on('success', function () {
            expect(mockArweaveStorage.sendTransaction).toHaveBeenCalledTimes(1);
            done();
        });

        writeTarballStream.on('error', function (err) {
            expect(err).toBeNull();
            done();
        });

        readTarballStream.on('end', function () {
            writeTarballStream.done();
        });

        writeTarballStream.on('end', function () {
            done();
        });

        writeTarballStream.on('data', function (data) {
            expect(data).toBeDefined();
        });

        readTarballStream.on('error', function (err) {
            expect(err).toBeNull();
            done();
        });

        readTarballStream.pipe(writeTarballStream);
    });

    test('writeTarball() abort', done => {
        const pkgName = 'readme-test';
        const newFileName = 'new-readme-0.0.0.tgz';
        const readTarballStream = fs.createReadStream(path.join(__dirname,'./__fixtures__/readme-test/test-readme-0.0.0.tgz'));

        const mockArweaveStorage = new ArweaveStorage();
        mockArweaveStorage.getPackageTxByFileName.mockResolvedValue([]);
        mockArweaveStorage.createDataTransaction.mockResolvedValue({id:'_MwkprJymcH-rB9doHh3zZqCQu4HAN_xMxkjQ2N3O9s'});
        mockArweaveStorage.sendTransaction.mockResolvedValue({status:200});

        const arweavePagckageManager = new ArweavePackageManager(pkgName, logger, mockArweaveStorage, _createEmtpyDatabase(), undefined);
        const writeTarballStream = arweavePagckageManager.writeTarball(newFileName);


      writeTarballStream.on('error', function (err) {
        expect(err).toBeTruthy();
        done();
      });

      writeTarballStream.on('data', function (data) {
        expect(data).toBeDefined();
        writeTarballStream.abort();
      });

      readTarballStream.pipe(writeTarballStream);
    });
  });

  describe('updatePackage() group', () => {

    test('updatePackage() success', done => {
        const pkgName = 'readme-test';
        const pkgJson = fs.readFileSync(path.join(__dirname,'./__fixtures__/readme-test/package.json'));
        const mockArweaveStorage = new ArweaveStorage();
        mockArweaveStorage.getPackageTxByFileName.mockResolvedValue(['hKMMPNh_emBf8v_at1tFzNYACisyMQNcKzeeE1QE9p8']);
        //const mockTransaction = { get: jest.fn(()=> pkgJson)} ;
        mockArweaveStorage.getTransactionData.mockResolvedValue(pkgJson)//mockTransaction);

        const arweavePagckageManager = new ArweavePackageManager(pkgName, logger, mockArweaveStorage, _createEmtpyDatabase(), undefined);

        let updateHandler = jest.fn((name, cb) => {
            cb();
        });
        let onWrite = jest.fn((_name: string, json: any, cb: Callback) => {
            // Write Package
            expect(json.test).toBe('test');
            cb(null);
        });
        let transform = jest.fn((json: any) => {
            // Transformation
            json.test = 'test';
            return json;
        });

        arweavePagckageManager.updatePackage(pkgName, updateHandler, onWrite, transform,
            (err: VerdaccioError) => {
                // on End
                expect(err).toBeNull();
                expect(transform).toHaveBeenCalledTimes(1);
                expect(updateHandler).toHaveBeenCalledTimes(1);
                expect(onWrite).toHaveBeenCalledTimes(1);
                done();
            });
    });

    describe('updatePackage() failures handler', () => {
      test('updatePackage() missing package', done => {
        const pkgName = 'readme-test';
        const mockArweaveStorage = new ArweaveStorage();
        mockArweaveStorage.getPackageTxByFileName.mockResolvedValue([]);

        const arweavePagckageManager = new ArweavePackageManager(pkgName, logger, mockArweaveStorage, _createEmtpyDatabase(), undefined);

        let updateHandler = jest.fn();
        let onWrite = jest.fn();
        let transform = jest.fn();
        arweavePagckageManager.updatePackage(pkgName, updateHandler, onWrite, transform,
            (err: VerdaccioError) => {
                // on End
                expect(err).not.toBeNull();
                expect(err.message).toBe(API_ERROR.NO_PACKAGE);
                expect(transform).toHaveBeenCalledTimes(0);
                expect(updateHandler).toHaveBeenCalledTimes(0);
                expect(onWrite).toHaveBeenCalledTimes(0);
                done();
            });
      });

      test('updatePackage() if updateHandler fails', done => {
        const pkgName = 'readme-test';
        const pkgJson = fs.readFileSync(path.join(__dirname,'./__fixtures__/readme-test/package.json'));
        const mockArweaveStorage = new ArweaveStorage();
        mockArweaveStorage.getPackageTxByFileName.mockResolvedValue(['hKMMPNh_emBf8v_at1tFzNYACisyMQNcKzeeE1QE9p8']);
        //const mockTransaction = { get: jest.fn(()=> pkgJson)} ;
        mockArweaveStorage.getTransactionData.mockResolvedValue(pkgJson)//mockTransaction);

        const arweavePagckageManager = new ArweavePackageManager(pkgName, logger, mockArweaveStorage, _createEmtpyDatabase(), undefined);

        let updateHandler = jest.fn((_name, cb) => {
          cb(new Error('Something is wrong'));
        });
        let onWrite = jest.fn();
        let transform = jest.fn();
        arweavePagckageManager.updatePackage(pkgName, updateHandler, onWrite, transform, (err: VerdaccioError) => {
          expect(err).not.toBeNull();
          expect(updateHandler).toHaveBeenCalledTimes(1);
          expect(onWrite).toHaveBeenCalledTimes(0);
          expect(transform).toHaveBeenCalledTimes(0);
          done();
        });
      });
    });
  });
});