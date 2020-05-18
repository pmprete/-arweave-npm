import Arweave from 'arweave/node';
import Transaction from 'arweave/node/lib/transaction';
import { JWKInterface } from 'arweave/node/lib/wallet';
import { AxiosResponse } from "axios";
import { and, equals } from 'arql-ops';

export interface IArweaveStorage {
  arweave: Arweave;
  runQuery(query: object): Promise<string[]>;
  getTransaction(id: string): Promise<Transaction>;
  sendTransaction(transaction: Transaction): Promise<AxiosResponse<any>>;
  createDataTransaction(data: string | Uint8Array, pkgName: string, fileName: string, tags?: string[][]): Promise<Transaction>
  getPackageTxByFileName(name: string, fileName: string, fromAddress: string|undefined): Promise<string[]>;
  getAllPackages(fromAddress?: string): Promise<string[]>;
}

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

  public async sendTransaction(transaction: Transaction): Promise<AxiosResponse<any>> {
    const result = await this.arweave.transactions.post(transaction);
    return result;
  }

  public async createDataTransaction(data: string | Uint8Array, pkgName: string, fileName: string, tags?: string[][]): Promise<Transaction> {
    if(!this.jwk)
      throw new Error('Undefined JWK, cant create a transaction without it');

    let transaction = await this.arweave.createTransaction({ data }, this.jwk);
    
    let defaultTags = [['Content-Type','application/json'], ['App-Name','verdaccio-arweave'], ['App-Version','0.0.1'],['Source','NPM'],
      ['Package-Name', pkgName], ['File-Name', fileName] ]
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
        equals('Source', 'NPM'),
        equals('Package-Name', name),
        equals('File-Name', fileName),
      );
    if(fromAddress) {
      myQuery = and(
        equals('from', fromAddress),
        equals('to', ''),
        equals('Source', 'NPM'),
        equals('Package-Name', name),
        equals('File-Name', fileName),
      );
    }
    const result = await this.runQuery(myQuery);
    return result;
  }

  public async getAllPackages(fromAddress?: string): Promise<string[]> {
    let myQuery = and(
        equals('to', ''),
        equals('Source', 'NPM'),
        equals('File-Name', 'name'),
     );
    if(fromAddress) {
      myQuery = and(
        equals('from', fromAddress),
        equals('to', ''),
        equals('Source', 'NPM'),
        equals('File-Name', 'name'),
      );
    }
    const txHashList = await this.runQuery(myQuery);
    const result = await Promise.all(txHashList.map((txHash) => { 
      return String(this.arweave.transactions.getData(txHash, {decode: true, string: true})); 
    }));
    return result;
  }

}