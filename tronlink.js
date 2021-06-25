import TronWeb from 'tronweb';
import { generateAccount } from 'tron-create-address';
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_TRONSCAN_API,
});

export const getLastTransactions = (address) => {
  return api.get(
    `api/contracts/transaction?sort=-timestamp&count=true&limit=1000&start=0&contract=${address}`
  );
};

export const tronWebInstance = {
  loggedIn: false,
  tronWeb: null,
  loading: null,
};

export const MINTER_ADDRESS = process.env.MINTER_ADDRESS;

const pollTronLink = (maxTries, pollInterval) => {
  return new Promise((resolve) => {
    let tries = 0;
    const timer = setInterval(() => {
      ++tries;
      if (window['tronWeb']?.ready) {
        clearInterval(timer);
        resolve({ tronWeb: window['tronWeb'], loggedIn: true });
      }
      if (tries >= maxTries) {
        const { privateKey } = generateAccount();
        const HttpProvider = TronWeb.providers.HttpProvider;
        const fullNode = new HttpProvider(TRON_WEB_URL);
        const solidityNode = new HttpProvider(TRON_WEB_URL);
        const eventServer = new HttpProvider(TRON_WEB_URL);
        const tronApi = new TronWeb(
          fullNode,
          solidityNode,
          eventServer,
          privateKey
        );
        tronApi.setHeader({ 'TRON-PRO-API-KEY': TRON_WEB_API_KEY });
        clearInterval(timer);
        resolve({ tronWeb: tronApi, loggedIn: false });
      }
    }, pollInterval);
  });
};

async function initTronWeb() {
  try {
    const { tronWeb, loggedIn } = await pollTronLink(20, 100);
    tronWebInstance.tronWeb = tronWeb;
    tronWebInstance.loggedIn = loggedIn;
  } catch (e) {
    console.error('tron ---> ', e);
    return e;
  }
}

export async function getMinterContract() {
  const { tronWeb } = await getTronWebInstance();
  const minter = await tronWeb['trx'].getContract(MINTER_ADDRESS);
  return tronWeb['contract'](minter.abi.entrys, MINTER_ADDRESS);
}

export async function getTronWebInstance() {
  tronWebInstance.loading = initTronWeb();
  await tronWebInstance.loading;
  return tronWebInstance;
}

export async function getAccountBalanceInTrx() {
  const { tronWeb, loggedIn } = await getTronWebInstance();
  let accountInfo = await tronWeb['trx']?.getAccount(
    tronWeb['defaultAddress']?.base58
  );
  return tronWeb['fromSun'](accountInfo?.balance);
}

export async function getMessageIfNodeDontCorrect() {
  const { tronWeb } = await getTronWebInstance();
  const isProd = process.env.NEXT_PUBLIC_TRON_WEB_URL.includes('api.trongrid');
  const isCorrectNode = tronWeb['fullNode']?.host?.includes(
    isProd ? 'api.trongrid' : 'api.nileex'
  );
  switch (true) {
    case isCorrectNode && isProd:
    case isCorrectNode && !isProd:
      return null;
    case !isCorrectNode && isProd:
      return 'Please change network to Tronlink to Mainnet (TronGrid)!';
    case !isCorrectNode && !isProd:
      return 'Please change network to Tronlink to Nile Testnet!';
  }
}

export async function triggerSmartContract(
  functionSelector,
  parameters,
  options,
  validationFN = null
) {
  return new Promise(async (resolve, reject) => {
    try {
      const { tronWeb } = await getTronWebInstance();
      const transactionObject = await tronWeb[
        'transactionBuilder'
      ].triggerSmartContract(
        AUCTION_ADDRESS,
        functionSelector,
        options,
        parameters,
        tronWeb['defaultAddress'].hex
      );

      if (!transactionObject.result || !transactionObject.result.result)
        reject('Unknown error');

      tronWeb['trx']
        .sign(transactionObject.transaction)
        .then(async (signedTransaction) => {
          if (!signedTransaction.signature) {
            return reject('Transaction was not signed properly');
          }
          tronWeb['trx']
            .sendRawTransaction(signedTransaction)
            .then(async (res) => {
              const interval = setInterval(async () => {
                const transactions = await getLastTransactions(AUCTION_ADDRESS);
                const item = transactions.data.data.filter(
                  (tr) => tr?.txHash === res?.txid
                )[0];
                if (!item) {
                  return;
                }
                clearInterval(interval);
                if (item?.contractRet === 'SUCCESS') {
                  resolve(res?.txid);
                } else {
                  reject(item?.contractRet);
                }
              }, 1000);
            })
            .catch((e) => {
              reject(e);
            });
        })
        .catch((e) => reject(e));
    } catch (e) {
      reject(e);
    }
  });
}

export const sendContractProcessingProcess = async (contract, address) => {
  return new Promise(async (resolve, reject) => {
    try {
      const txid = await contract.send();
      const interval = setInterval(async () => {
        const transactions = await getLastTransactions(address);
        const item = transactions.data.data.filter(
          (tr) => tr?.txHash === txid
        )[0];
        if (!item) {
          return;
        }
        clearInterval(interval);
        if (item?.contractRet === 'SUCCESS') {
          resolve(txid);
        } else {
          reject(item?.contractRet);
        }
      }, 1000);
    } catch (e) {
      reject(e);
    }
  });
};

export const exampleUseContract = () => {
  try {
    const { tronWeb } = await getTronWebInstance();
    let options = {
      callValue: tronWeb['toSun'](art?.buyNowPrice),
      feeLimit: tronWeb['toSun'](100),
    };
    const parameters = [
      {
        type: 'uint256',
        value: id,
      },
    ];
    await triggerSmartContract('buyNow(uint256)', parameters, options);
  } catch (error) {
    console.log(error);
  }
};
