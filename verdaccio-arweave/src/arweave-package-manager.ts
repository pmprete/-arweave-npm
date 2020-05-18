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

export const pkgFileName = 'package.json';

const packageAlreadyExist = function (name: string): VerdaccioError {
  return getConflict(`${name} package already exist`);
};

export default class ArweavePackageManager implements ILocalPackageManager {
  public logger: Logger;
  public packageName: string;
  public storage: ArweaveStorage;
  public storageAddress: string|undefined;

  public constructor(
    packageName: string,
    logger: Logger,
    storage: ArweaveStorage,
    storageAddress: string|undefined
  ) {
    this.logger = logger;
    this.packageName = packageName;
    this.storage = storage;
    this.storageAddress = storageAddress;
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
    this.logger.debug({ name }, 'arweave: [updatePackage] for @{pkgName}');
    this._readPackage(name)
    .then((metadata: Package): void => {
        updateHandler(metadata, (err: VerdaccioError): void => {
          if (err) {
            this.logger.error(
              { name: name, err: err.message },
              'arweave: [updatePackage] updateHandler @{name} package has failed err: @{err}'
            );
            return onEnd(err);
          }
          try {
            onWrite(name, transformPackage(metadata), onEnd);
          } catch (err) {
            this.logger.error(
              { name: name, err: err.message },
              'arweave: [updatePackage] onWrite @{name} package has failed err: @{err}'
            );
            return onEnd(getInternalError(err.message));
          }
        });
      },
      (err: Error): void => {
        this.logger.error({ name: name, err: err.message }, 'arweave: [updatePackage] @{name} package has failed err: @{err}');
        onEnd(getInternalError(err.message));
      }
    )
    .catch(
      (err: Error): Callback => {
        this.logger.error(
          { name, error: err },
          'arweave: [updatePackage] trying to update @{name} and was not found on storage err: @{error}'
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
    this.logger.error({ name: fileName},"arweave: [deletePackage] you cant delete @{name} from the permaweb");
    callback(getInternalError("You can't delete packages from the permaweb"));
  }

  /**
   * Delete a package (folder, path)
   * This happens after all versions ar tarballs have been removed.
   * @param callback
   */
  public removePackage(callback: CallbackAction): void {
    this.logger.error("arweave: [removePackage] you cant delete from the permaweb");
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
    this.logger.debug({ name }, 'arweave: [createPackage] for @{name}');
    this._getFileTx(name, pkgFileName)
      .then((txHash: string): void => {
        if (txHash) {
          this.logger.debug({ name }, 'arweave: [createPackage] for @{name} has failed, it already exist');
          cb(packageAlreadyExist(name));
        } else {
          this.logger.debug({ name }, 'arweave: [createPackage] for @{name} on storage');
          this.savePackage(name, metadata, cb);
        }
      })
      .catch((err: Error): void => {
        this.logger.error({ name: name, err: err.message }, 'arweave: create package @{name} has failed err: @{err}');
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
    this.logger.debug({ pkgName }, 'arweave: [savePackage] save a package: @{pkgName}');
    this._savePackage(pkgName, pkg)
      .then((): void => {
        this.logger.debug({ name }, 'arweave: [savePackage] @{name} has been saved successfully on storage');
        cb(null);
      })
      .catch((err: Error): void => {
        this.logger.error({ pkgName, err: err.message }, 'arweave: [savePackage] @{pkgName} has failed err: @{err}');
        return cb(err);
      });
  }

  /**
   * Read a package from storage
   * @param pkgName package name
   * @param cb callback
   */
  public readPackage(pkgName: string, cb: ReadPackageCallback): void {
    this.logger.debug({ pkgName }, 'arweave: [readPackage] for @{pkgName}');
    this._readPackage(pkgName)
      .then((json: Package): void => {
        this.logger.debug({ pkgName }, 'arweave: [readPackage] @{pkgName} was fetched from storage');
        cb(null, json);
      })
      .catch((err: Error): void => {
        this.logger.debug({ pkgName: pkgName, err: err.message }, 'arweave: [readPackage] @{pkgName} has failed err: @{err}');
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

    this._getFileTx(this.packageName, name)
    .then((txHash: string): void => {
        if (txHash) {
          this.logger.debug({ packageName: this.packageName, fileName: name }, 'arweave: [writeTarball] @{packageName} package @{fileName} file already exist on storage');
          uploadStream.emit('error', packageAlreadyExist(name));
        } else {
          this.logger.debug({ name }, 'arweave: [writeTarball] emit open @{name}');

          // Data is flushed from uploadStream in chunks,
          // this callback will be executed for each chunk
          uploadStream.on('data', (chunk) => {
            chunks.push(chunk); // push data chunk to array
          });

          uploadStream.done = (): void => {
            uploadStream.on('end', async (): Promise<void>  => {
                this.logger.debug({ packageName: this.packageName, fileName: name }, 'arweave: [writeTarball event: end] packageName @{packageName} file @{name}');
                // create the final data Buffer from data chunks;
                fileBuffer = Buffer.concat(chunks);

                let transaction = await this.storage.createDataTransaction(fileBuffer, this.packageName, name);
                this.logger.trace({ transaction }, 'arweave: [_getFileTx] transaction @{transaction}');
                let result = await this.storage.sendTransaction(transaction);
                if(result.status != 200) {
                  this.logger.error({name:name, err: result.statusText}, 'arweave: [writeTarball] @{name} has failed, cause: @{err}');
                  uploadStream.emit('error', getCode(result.status, result.statusText));
                  return;
                }
                this.logger.debug({ name }, 'arweave: [writeTarball] has been successfully uploaded to the storage');
                uploadStream.emit('success');
            });
          };

          uploadStream.abort = (): void => {
            this.logger.warn({ name }, 'arweave: [writeTarball] upload stream has been aborted for @{name}');
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
    this.logger.debug({ packageName: this.packageName, fileName: name }, 'arweave: [readTarball]  packageName @{packageName} file @{name}');

    this._getFileTx(this.packageName, name)
    .then(async (txHash) => {
      this.logger.debug({ packageName: this.packageName, fileName: name, txHash }, 
        'arweave: [readTarball]  packageName @{packageName} file @{name} txHash @{txHash}');

      if(!txHash){
        this.logger.debug({ packageName: this.packageName, fileName: name }, 
          'arweave: [readTarball]  packageName @{packageName} file @{name} not found on storage');
        readTarballStream.emit('error', getNotFound());
        return;
      }

      const transaction = await this.storage.getTransaction(txHash);
      const txData = transaction.get('data', {decode: true, string:false});
      if (!txData || txData.length == 0) {
        this.logger.error({ packageName: this.packageName, fileName: name, txHash }, 
          'arweave: [readTarball]  packageName @{packageName} file @{name} txHash @{txHash} was fetched from storage and is empty');
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

  private _getFileTx(name: string, fileName: string): Promise<string> {
    return new Promise(
      async (resolve, reject): Promise<void> => {
        try {
          const txHashes = await this.storage.getPackageTxByFileName(name, fileName, this.storageAddress);
          const exist = txHashes[0];
          this.logger.debug({ name, fileName, exist }, 'arweave: Tx Hash for @{name} @{fileName} exist successfully: @{exist}');
          resolve(exist);
        } catch (err) {
          this.logger.error(
            { name: name,fileName: fileName,  err: err.message },
            'arweave: getFileTx exist package @{name} @{fileName} has failed, cause: @{err}'
          );
          reject(getInternalError(err.message));
        }
      }
    );
  }

  private async _savePackage(name: string, metadata: Package): Promise<void> {
    let tags = [ ['Package-Version', metadata["dist-tags"]['latest']] ];
    let transaction = await this.storage.createDataTransaction(this.convertToString(metadata), name, pkgFileName, tags);
    this.logger.trace({ transaction }, 'arweave: [_savePackage] transaction @{transaction}');
    let result = await this.storage.sendTransaction(transaction);
    if(result.status != 200) {
      this.logger.error({name:name, err: result.statusText}, 'arweave: [_savePackage] @{name} has failed, cause: @{err}');
      throw getCode(result.status, result.statusText);
    }
  }

  public convertToString(value: Package): string {
    return JSON.stringify(value, null, '\t');
  }

  private async _readPackage(name: string): Promise<Package> {
    const txHash = await this._getFileTx(name, pkgFileName);
    if(!txHash) {
      this.logger.error({name:name}, 'arweave: [_readPackage] @{name} was not found');
      throw getNotFound();
    }
    const transaction = await this.storage.getTransaction(txHash);
    this.logger.debug({ name }, 'arweave:[_readPackage]  @{name} was found on storage');
    const data = transaction.get('data', {decode: true, string: true});
    const response: Package = JSON.parse(data);
    return response;
  }

}
