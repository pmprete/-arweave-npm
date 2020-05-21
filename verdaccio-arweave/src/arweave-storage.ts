import Arweave from 'arweave/node';
import Transaction from 'arweave/node/lib/transaction';
import { JWKInterface } from 'arweave/node/lib/wallet';
import { AxiosResponse } from "axios";
import { and, equals } from 'arql-ops';

export interface IArweaveStorage {
  arweave: Arweave;
  runQuery(query: object): Promise<string[]>;
  getTransaction(id: string): Promise<Transaction>;
  getTransactionData(id: string, isString: boolean): Promise<string | Uint8Array>;
  sendTransaction(transaction: Transaction): Promise<AxiosResponse<any>>;
  createDataTransaction(type: string, data: string | Uint8Array, pkgName: string, fileName: string, tags?: string[][]): Promise<Transaction> 
  getPackageTxByFileName(name: string, fileName: string, fromAddress: string|undefined): Promise<string[]>;
  getPackageTxByFileNameAndVersion(name: string, fileName: string, pkgVersion:string, fromAddress?: string): Promise<string[]>
  getAllPackagesHashes(fromAddress?: string): Promise<string[]>;
}

export const env = 'TEST-6';
export const source = 'NPM';

export default class ArweaveStorage implements IArweaveStorage {
  public arweave: Arweave;
  public jwk: JWKInterface|undefined;

  public constructor(arweave: Arweave, jwk: string|undefined) {
    this.arweave = arweave;
    this.jwk = undefined;
    if(jwk) {
      this.jwk = JSON.parse(jwk);
    }
  }

  public async runQuery(query: Object): Promise<string[]> {
    const result = await this.arweave.arql(query);
    return result;
  }

  public async getTransaction(id: string): Promise<Transaction> {
    const result = await this.arweave.transactions.get(id);
    //Validate transaction integrity
    const isValid = await this.arweave.transactions.verify(result);
    if(!isValid) {
      throw new Error(
        `Invalid transaction signature! The transaction data does not match the signature.`
      );
    }
    return result;
  }

  public async getTransactionData(id: string, isString: boolean): Promise<string | Uint8Array> {
    const result = await this.arweave.transactions.getData(id, {decode:true, string: isString});
    return result;
  }

  private delay(ms: number) {
      return new Promise( resolve => setTimeout(resolve, ms) );
  }

  public async sendTransaction(transaction: Transaction): Promise<AxiosResponse<any>> {
    return new Promise(async (resolve,reject) => {
      const result = await this.arweave.transactions.post(transaction);
      if(result.status = 200) {
        console.log('Delay', Number(transaction.data_size)/10000+1000);
        await this.delay(Number(transaction.data_size)/10000+1000);
        // let response = await this.arweave.transactions.getStatus(transaction.id);
        // while(response.status == 202) {
        //   await this.delay(2000);
        //   response = await this.arweave.transactions.getStatus(transaction.id);   
        // }
        // if(response.status > 202) {
        //   reject(response);
        // }
        resolve(result);
      } else {
        reject(result);
      }
    });
  }

  public async createDataTransaction(type: string, data: string | Uint8Array, pkgName: string, fileName: string, tags?: string[][]): Promise<Transaction> {
    if(!this.jwk)
      throw new Error('Undefined JWK, cant create a transaction without it');

    let transaction = await this.arweave.createTransaction({ data }, this.jwk);
    
    let defaultTags = [['Content-Type', type], ['App-Name','verdaccio-arweave'], ['App-Version','0.0.1'],['Source', source],
    ['ENV', env], ['Package-Name', pkgName], ['File-Name', fileName] ]
    for (const tag of defaultTags) {
        transaction.addTag(tag[0], tag[1]);
    }
    if(tags){
        for (const tag of tags) {
            transaction.addTag(tag[0], tag[1]);
        }
    }
    await this.arweave.transactions.sign(transaction, this.jwk);
    return transaction;
  }

  public async getPackageTxByFileName(name: string, fileName: string, fromAddress?: string): Promise<string[]> {
    let myQuery = and(
        equals('to', ''),
        equals('Source', source),
        equals('ENV', env),
        equals('Package-Name', name),
        equals('File-Name', fileName),
      );
    if(fromAddress) {
      myQuery = and(
        equals('from', fromAddress),
        equals('to', ''),
        equals('Source', source),
        equals('ENV', env),
        equals('Package-Name', name),
        equals('File-Name', fileName),
      );
    }
    const result = await this.runQuery(myQuery);
    return result;
  }

  public async getPackageTxByFileNameAndVersion(name: string, fileName: string, pkgVersion:string, fromAddress?: string): Promise<string[]> {
    let myQuery = and(
        equals('to', ''),
        equals('Source', source),
        equals('ENV', env),
        equals('Package-Name', name),
        equals('Package-Version', pkgVersion),
        equals('File-Name', fileName),
      );
    if(fromAddress) {
      myQuery = and(
        equals('from', fromAddress),
        equals('to', ''),
        equals('Source', source),
        equals('ENV', env),
        equals('Package-Name', name),
        equals('Package-Version', pkgVersion),
        equals('File-Name', fileName),
      );
    }
    const result = await this.runQuery(myQuery);
    return result;
  }

  public async getAllPackagesHashes(fromAddress?: string): Promise<string[]> {
    let myQuery = and(
        equals('to', ''),
        equals('Source', source),
        equals('ENV', env),
        equals('File-Name', 'package.json'),
     );
    if(fromAddress) {
      myQuery = and(
        equals('from', fromAddress),
        equals('to', ''),
        equals('Source', source),
        equals('ENV', env),
        equals('File-Name', 'package.json'),
      );
    }
    const txHashList = await this.runQuery(myQuery);
    return txHashList;
  }

}