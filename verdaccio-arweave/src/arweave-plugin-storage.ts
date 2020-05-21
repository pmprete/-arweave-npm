import {
  Logger,
  Callback,
  IPluginStorage,
  PluginOptions,
  IPackageStorage,
  TokenFilter,
  Token,
  Config,
  onEndSearchPackage,
  onSearchPackage,
  onValidatePackage,
  StorageList,
  GenericBody,
  Package
} from '@verdaccio/types';
import { getInternalError, getServiceUnavailable, getConflict, getCode } from '@verdaccio/commons-api';

import fs from 'fs';
import Arweave from 'arweave/node';

import ArweaveStorage from './arweave-storage';
import { ArweaveConfig } from '../types/index';
import ArweavePackageManager from './arweave-package-manager';

export type PackageJsonFiles = {
  [key: string]: Package;
};

export interface MemoryLocalStorage {
  secret: string;
  list: string[];
  txHashList: GenericBody;
  files: PackageJsonFiles;
}

export default class ArweavePluginStorage implements IPluginStorage<ArweaveConfig> {
  config: ArweaveConfig & Config;
  version?: string;
  arweaveStorage: ArweaveStorage;
  public logger: Logger;
  public jwk: string;
  public storageAddress?: string;
  private cache: MemoryLocalStorage;


  public constructor(
    config: ArweaveConfig & Config,
    options: PluginOptions<ArweaveConfig>
  ) {
    this.config = config;
    this.logger = options.logger;

    this.jwk = '';
    if(this.config.jwk) {
      this.jwk = fs.readFileSync(this.config.jwk, 'utf8');
    }
    this.storageAddress = this.config.storageAddress;

    let arweave = Arweave.init({
      host: this.config.host || 'arweave.net',
      port: this.config.port,
      protocol: this.config.protocol || 'https',
      timeout: this.config.timeout || 20000,
      logging: this.config.logging || false,
    });
    this.cache = this._createEmtpyDatabase();
    this.arweaveStorage = new ArweaveStorage(arweave, this.jwk);
  }

  /**
   *
   */
  public async getSecret(): Promise<string> {
    return Promise.resolve(this.cache.secret);
  }

  public async setSecret(secret: string): Promise<any> {
    return new Promise((resolve): void => {
      this.cache.secret = secret;
      resolve(null);
    });
  }

  /**
   * Add a new element.
   * @param {*} name
   * @return {Error|*}
   */
  public add(name: string, cb: Callback): void {
    this.logger.debug({ name },'arweave: [plugin add] @{name} init');
    if (this.cache.list.indexOf(name) === -1) {
      this.logger.debug({ name },'arweave: [plugin add] @{name} not on the list, adding it');
      this.cache.list.push(name);
    }
    cb(null);
  }

  /**
   * Perform a search in your registry
   * @param onPackage
   * @param onEnd
   * @param validateName
   */
  public search(
    onPackage: onSearchPackage,
    onEnd: onEndSearchPackage,
    validateName: onValidatePackage
  ): void {
    this.logger.warn('arweave: [plugin search] method has not been implemented yet');

    onEnd(getServiceUnavailable('search not implemented yet'));
  }

  /**
   * Remove an element from the database.
   * @param {*} name
   * @return {Error|*}
   */
  public remove(name: string, cb: Callback): void {
    this.logger.warn({ name }, 'arweave: [plugin remove] has been disabled @{name}');

    cb(getServiceUnavailable("remove method is disabled on arweave. Your can't remove packages from the permaweb"));
  }

  /**
   * Return all database elements.
   * @return {Array}
   */
  public get(cb: Callback): void {
    this.logger.debug('arweave: [plugin get] init');
    this.logger.debug({cache:this.cache}, 'arweave: [plugin get] cache: @{cache}');
    this.arweaveStorage.getAllPackagesHashes(this.storageAddress)
    .then(async (txHashList: string[]) => {
      this.logger.trace({ number: txHashList }, 'arweave: [plugin get] txHashList @{txHashList}');

      const newTxHashList = txHashList.filter(txHash => !this.cache.txHashList[txHash]);
      this.logger.trace({ newTxHashList }, 'arweave: [plugin get] newTxHashList @{newTxHashList}');
      const newPkgsJsons = await Promise.all(newTxHashList.map((txHash) => { 
        return this.arweaveStorage.getTransactionData(txHash, true)
        .then((data) => {
          return JSON.parse(String(data));
        }); 
      }));

      for(let i=0; i < newTxHashList.length; i++) {

        let pkgName = newPkgsJsons[i].name;
        if (this.cache.list.indexOf(pkgName) === -1) {
          this.cache.list.push(pkgName);
        }
        this.cache.txHashList[newTxHashList[i]] = pkgName;
        this.cache.files[pkgName] = newPkgsJsons[i];
      }
      this.logger.trace({ names:this.cache.list }, 'arweave: [plugin get] names @{names}');
      cb(null, this.cache.list);
    })
    .catch((err) => {
      this.logger.error({err},'arweave: [plugin get] internal error @{err}');
      cb(getInternalError(err.message));
    });
  }

  /**
   * Create an instance of the `PackageStorage`
   * @param packageName
   */
  public getPackageStorage(packageName: string): IPackageStorage {
    const packageAccess = this.config.getMatchedPackagesSpec(packageName);

    let packageAddress = packageAccess ? packageAccess.storage : undefined;
    if(!packageAddress) {
      packageAddress = this.storageAddress;
    }
    return new ArweavePackageManager(packageName, this.logger, this.arweaveStorage, this.cache, packageAddress);
  }

  /**
   * All methods for npm token support
   * more info here https://github.com/verdaccio/verdaccio/pull/1427
   */

  public saveToken(token: Token): Promise<any> {
    this.logger.warn({ token }, 'arweave: [plugin saveToken] has not been implemented yet @{token}');

    return Promise.reject(getServiceUnavailable('save token method not implemented'));
  }

  public deleteToken(user: string, tokenKey: string): Promise<any> {
    this.logger.warn({ tokenKey, user }, 'arweave: [plugin deleteToken] has not been implemented yet @{user}');

    return Promise.reject(getServiceUnavailable('delete token method not implemented'));
  }

  public readTokens(filter: TokenFilter): Promise<Token[]> {
    this.logger.warn({ filter }, 'arweave: [plugin readTokens] has not been implemented yet @{filter}');

    return Promise.reject(getServiceUnavailable('read tokens method not implemented'));
  }

  private _createEmtpyDatabase(): MemoryLocalStorage {
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
}
