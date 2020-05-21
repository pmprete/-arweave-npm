import {
  Callback,
  Logger,
  ILocalPackageManager,
  StorageUpdateCallback,
  PackageTransformer,
  StorageWriteCallback,
  CallbackAction,
  Package,
  ReadPackageCallback
} from "@verdaccio/types";
import { UploadTarball, ReadTarball } from "@verdaccio/streams";
import { getNotFound, getConflict, getInternalError, VerdaccioError, getCode } from '@verdaccio/commons-api';

import ArweaveStorage from "./arweave-storage";
import { MemoryLocalStorage } from "./arweave-plugin-storage";

export const pkgFileName = 'package.json';

const packageAlreadyExist = function (name: string): VerdaccioError {
  return getConflict(`${name} package already exist`);
};

export default class ArweavePackageManager implements ILocalPackageManager {
  public logger: Logger;
  public packageName: string;
  public storage: ArweaveStorage;
  public cache: MemoryLocalStorage;
  public storageAddress: string|undefined;

  public constructor(
    packageName: string,
    logger: Logger,
    storage: ArweaveStorage,
    cache: MemoryLocalStorage,
    storageAddress: string|undefined
  ) {
    this.logger = logger;
    this.packageName = packageName;
    this.storage = storage;
    this.storageAddress = storageAddress;
    this.cache = cache;
  }

  /**
   * Handle a metadata update and
   * @param name
   * @param updateHandler
   * @param onWrite
   * @param transformPackage
   * @param onEnd
   */
  public updatePackage(
    name: string,
    updateHandler: StorageUpdateCallback,
    onWrite: StorageWriteCallback,
    transformPackage: PackageTransformer,
    onEnd: CallbackAction
  ): void {
    this.logger.debug({ name }, 'arweave: [package manager updatePackage] for @{name}');
    this._readPackage(name)
      .then((metadata: Package): void => {
        updateHandler(metadata, (err: VerdaccioError): void => {
          if (err) {
            this.logger.error(
              { name: name, err: err.message },
              'arweave: [package manager updatePackage] updateHandler @{name} package has failed err: @{err}'
            );
            return onEnd(err);
          }
          try {
            onWrite(name, transformPackage(metadata), onEnd);
          } catch (err) {
            this.logger.error(
              { name: name, err: err.message },
              'arweave: [package manager updatePackage] onWrite @{name} package has failed err: @{err}'
            );
            return onEnd(getInternalError(err.message));
          }
        });
      },
      (err: Error): void => {
        this.logger.error({ name: name, err: err.message }, 'arweave: [package manager updatePackage] @{name} package has failed err: @{err}');
        onEnd(getInternalError(err.message));
      }
    )
    .catch(
      (err: Error): Callback => {
        this.logger.error(
          { name, error: err },
          'arweave: [package manager updatePackage] trying to update @{name} and was not found on storage err: @{error}'
        );
        // @ts-ignore
        return onEnd(getNotFound());
      }
    );
  }

  /**
   * Delete a specific file (tarball or package.json)
   * @param fileName
   * @param callback
   */
  public deletePackage(fileName: string, callback: CallbackAction): void {
    this.logger.error({ name: fileName},"arweave: [package manager deletePackage] you cant delete @{name} from the permaweb");
    callback(getInternalError("You can't delete packages from the permaweb"));
  }

  /**
   * Delete a package (folder, path)
   * This happens after all versions ar tarballs have been removed.
   * @param callback
   */
  public removePackage(callback: CallbackAction): void {
    this.logger.error("arweave: [package manager removePackage] you cant delete from the permaweb");
    callback(getInternalError("You can't remove packages from the permaweb"));
  }

  /**
   * Publish a new package (version).
   * @param name
   * @param data
   * @param callback
   */
  public createPackage(
    name: string,
    metadata: Package,
    cb: CallbackAction
  ): void { 
    this.logger.debug({ name }, 'arweave: [package manager createPackage] for @{name}');
    this.logger.trace({metadata}, 'arweave: [package manager createPackage] metadata @{metadata}');
    this.logger.trace({cache:this.cache}, 'arweave: [package manager createPackage] cache @{cache}');
    if(this.cache.list[name] && this.cache.files[name]){
      this.logger.debug({ name }, 'arweave: [package manager createPackage] for @{name} has failed, it already exist');
      cb(packageAlreadyExist(name));
    }
    this._getFileTxByVersion(name, pkgFileName, metadata["dist-tags"]["latest"])
      .then((txHash: string): void => {
        this.logger.debug({ txHash }, 'arweave: [package manager createPackage] for @{name} txHash:@{txHash}');
        if (!txHash) {
          this.logger.debug({ name }, 'arweave: [package manager createPackage] for @{name} has failed, it already exist');
          cb(packageAlreadyExist(name));
        } else {
          this.logger.debug({ name }, 'arweave: [package manager createPackage] for @{name} creating');
          //save in cache because its updated afterwards, so we would be recording 2 times the package json
          //this.savePackage(name,metadata,cb);
          if (this.cache.list.indexOf(name) === -1) {
            this.cache.list.push(name);
          }
          this.cache.files[name] = metadata;
          this.logger.debug({ name }, 'arweave: [package manager createPackage] for @{name} created in cache');
          cb(null);
        }
      })
      .catch((err: Error): void => {
        this.logger.error({ name: name, err: err.message }, 'arweave: [package manager createPackage] create package @{name} has failed err: @{err}');
        cb(getInternalError(err.message));
      });
  }

  /**
   * Perform write anobject to the storage.
   * Similar to updatePackage but without middleware handlers
   * @param pkgName package name
   * @param pkg package metadata
   * @param cb callback
   */
  public savePackage(pkgName: string, pkg: Package, cb: CallbackAction): void {
    this.logger.debug({ pkgName }, 'arweave: [package manager savePackage] save a package: @{pkgName}');
    this._savePackage(pkgName, pkg)
      .then((): void => {
        this.logger.debug({ pkgName }, 'arweave: [package manager savePackage] @{pkgName} has been saved successfully on storage');
        cb(null);
      })
      .catch((err: Error): void => {
        this.logger.error({ pkgName, err: err.message }, 'arweave: [package manager savePackage] @{pkgName} has failed err: @{err}');
        return cb(err);
      });
  }

  /**
   * Read a package from storage
   * @param pkgName package name
   * @param cb callback
   */
  public readPackage(pkgName: string, cb: ReadPackageCallback): void {
    this.logger.debug({ pkgName }, 'arweave: [package manager readPackage] for @{pkgName}');
    this._readPackage(pkgName)
      .then((json: Package): void => {
        this.logger.debug({ pkgName }, 'arweave: [package manager readPackage] @{pkgName} was fetched from storage');
        cb(null, json);
      })
      .catch((err: Error): void => {
        this.logger.debug({ pkgName: pkgName, err: err.message }, 'arweave: [package manager readPackage] @{pkgName} has failed err: @{err}');
        cb(err);
      });
  }

  /**
   * Create writtable stream (write a tarball)
   * @param name
   */
  public writeTarball(name: string): UploadTarball {
    const uploadStream: UploadTarball = new UploadTarball({});
    // Store file data chunks in this array
    let chunks = <any>[];
    // We can use this variable to store the final data
    let fileBuffer;

    this._getLatestFileTx(this.packageName, name)
    .then((txHash: string): void => {
        if (txHash) {
          this.logger.warn({ packageName: this.packageName, fileName: name }, 'arweave: [package manager writeTarball] @{packageName} package @{fileName} file already exist on storage');
          uploadStream.emit('error', packageAlreadyExist(name));
        } else {
          this.logger.debug({ name }, 'arweave: [package manager writeTarball] emit open @{name}');

          // Data is flushed from uploadStream in chunks,
          // this callback will be executed for each chunk
          uploadStream.on('data', (chunk) => {
            chunks.push(chunk); // push data chunk to array
          });

          uploadStream.done = (): void => {
            uploadStream.on('end', async (): Promise<void>  => {
              try{
                this.logger.debug({ packageName: this.packageName, fileName: name }, 'arweave: [package managerwriteTarball event: end] packageName @{packageName} fileName @{fileName}');
                // create the final data Buffer from data chunks;
                fileBuffer = Buffer.concat(chunks);

                let transaction = await this.storage.createDataTransaction('application/octet-stream', fileBuffer, this.packageName, name);
                this.logger.trace({ id: transaction.id }, 'arweave: [package manager writeTarball] transaction @{id}');
                await this.storage.sendTransaction(transaction);
                this.logger.debug({ name }, 'arweave: [package manager writeTarball] has been successfully uploaded to the storage');
                uploadStream.emit('success');
              } catch(err) {
                this.logger.error({err}, 'arweave: [package manager writeTarball on end] @{name} has failed, cause: @{err}');
                  uploadStream.emit('error', err);
              }
            });
          };

          uploadStream.abort = (): void => {
            this.logger.warn({ name }, 'arweave: [package manager writeTarball] upload stream has been aborted for @{name}');
            uploadStream.emit('error', 'upload has been aborted');
          };

          uploadStream.emit('open');
        }
      })
      .catch((err) => {
        uploadStream.emit('error', err);
      });

    return uploadStream;
  }

  /**
   * Create a readable stream (read a from a tarball)
   * @param name
   */
  public readTarball(name: string): ReadTarball {
    const readTarballStream = new ReadTarball({});
    this.logger.debug({ packageName: this.packageName, fileName: name }, 'arweave: [package manager readTarball]  packageName @{packageName} file @{name}');

    this._getLatestFileTx(this.packageName, name)
    .then(async (txHash) => {
      this.logger.debug({ packageName: this.packageName, fileName: name, txHash }, 
        'arweave: [package manager readTarball]  packageName @{packageName} file @{name} txHash @{txHash}');

      if(!txHash){
        this.logger.debug({ packageName: this.packageName, fileName: name }, 
          'arweave: [package manager readTarball]  packageName @{packageName} file @{name} not found on storage');
        readTarballStream.emit('error', getNotFound());
        return;
      }

      const transaction = await this.storage.getTransaction(txHash);
      const txData = transaction.get('data', {decode: true, string:false});
      if (!txData || txData.length == 0) {
        this.logger.error({ packageName: this.packageName, fileName: name, txHash }, 
          'arweave: [package manager readTarball]  packageName @{packageName} file @{name} txHash @{txHash} was fetched from storage and is empty');
        readTarballStream.emit('error', getInternalError('file content empty'));
        return;
      }
      readTarballStream.emit('content-length', txData.length);
      readTarballStream.emit('open');
      readTarballStream.push(txData);
      readTarballStream.push(null);
    })
    .catch((err) =>{
      readTarballStream.emit('error', err);
    });

    return readTarballStream;
  }

  private _getLatestFileTx(name: string, fileName: string): Promise<string> {
    return new Promise(
      async (resolve, reject): Promise<void> => {
        try {
          const txHashes = await this.storage.getPackageTxByFileName(name, fileName, this.storageAddress);
          const txHash = txHashes.length == 0 ? undefined : txHashes[txHashes.length-1];
          this.logger.debug({ name, fileName, txHash }, 'arweave: [package manager _getLatestFileTx]Tx Hash @{txHash} for @{name} file @{fileName} getPackageTxByFileName successfully');
          resolve(txHash);
        } catch (err) {
          this.logger.error(
            { name: name,fileName: fileName,  err: err.message },
            'arweave: [package manager _getLatestFileTx] package @{name} @{fileName} has failed, cause: @{err}'
          );
          reject(getInternalError(err.message));
        }
      }
    );
  }

  private _getFileTxByVersion(name: string, fileName: string, pkgVersion: string): Promise<string> {
    return new Promise(
      async (resolve, reject): Promise<void> => {
        try {
          const txHashes = await this.storage.getPackageTxByFileNameAndVersion(name, fileName, pkgVersion, this.storageAddress);
          const txHash = txHashes.length == 0 ? undefined : txHashes[txHashes.length-1];
          this.logger.debug({ name, fileName, txHash }, 'arweave: [package manager _getFileTxByVersion]Tx Hash for @{name} @{fileName} get file successfully: @{txHash}');
          resolve(txHash);
        } catch (err) {
          this.logger.error(
            { name: name,fileName: fileName,  err: err.message },
            'arweave: [package manager _getFileTxByVersion] package @{name} @{fileName} has failed, cause: @{err}'
          );
          reject(getInternalError(err.message));
        }
      }
    );
  }

  private async _savePackage(name: string, metadata: Package): Promise<void> {
    try {
      let transaction = await this.storage.createDataTransaction('application/json', this.convertToString(metadata), name, pkgFileName, [['Package-Version', metadata["dist-tags"]['latest']]]);
      this.logger.trace({ id: transaction.id }, 'arweave: [package manager _savePackage] transaction @{id}');
      await this.storage.sendTransaction(transaction);
      this.logger.trace({ name, id: transaction.id }, 'arweave: [package manager _savePackage] @{name} transaction @{id} successfuly sent');
      if (this.cache.list.indexOf(name) === -1) {
        this.cache.list.push(name);
      }
      this.cache.files[name] = metadata;
      this.cache.txHashList[transaction.id] = name;
    } catch(err) {
      this.logger.error({name:name, err}, 'arweave: [package manager _savePackage] @{name} has failed, cause: @{err}');
      throw err;
    }
  }

  public convertToString(value: Package): string {
    return JSON.stringify(value, null, '\t');
  }

  private async _readPackage(name: string): Promise<Package> {
    let pkgJson = this.cache.files[name];
    this.logger.debug({cache:this.cache}, 'arweave: [package manager _readPackage] cache @{cache}');
    const txHash = await this._getLatestFileTx(name, pkgFileName);
    this.logger.debug({name, txHash}, 'arweave: [package manager _readPackage] @{name} returned @{txHash}');
    if(!txHash) {
      if(!pkgJson) {
        this.logger.error({name}, 'arweave: [package manager _readPackage] @{name} was not found');
        throw getNotFound(name);
      } else {
        return pkgJson;
      }
    }
    if(Object.keys(this.cache.txHashList).indexOf(txHash) != -1) {
      return pkgJson;
    }
    //TODO: Figure out why getTransaction is ok but data comes empty, this deprives us from verification
    // const transaction = await this.storage.getTransaction(txHash);
    // this.logger.debug({ txHash, name }, 'arweave:[package manager _readPackage]  @{name} was found on storage @{txHash}');
    // this.logger.trace({ transaction}, 'arweave: [package manager _readPackage] transaction @{transaction}');
    // const data = transaction.get('data', {decode: true, string: true});
    const data = await this.storage.getTransactionData(txHash, true);
    this.logger.trace({data}, 'arweave: [package manager _readPackage] data @{data}');
    const response: Package = JSON.parse(String(data));
    return response;
  }

}
