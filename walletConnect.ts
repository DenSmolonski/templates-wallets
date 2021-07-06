import WalletConnectProvider from '@walletconnect/web3-provider';
import Web3Modal from 'web3modal';
import * as Ethers from 'ethers';
import Web3 from 'web3';

const INFURA_ID = '12f7c0dffbca4ff7b5426c68e613328c'; // test

const TEST_NETWORK = process.env.NODE_ENV !== 'production';

const ABI_ERC721 = '';

const CHAIN_ADDRESS = TEST_NETWORK
  ? '0x1111111111111111111111111111111111'
  : '0x1111111111111111111111111111111111';

enum EtherChainId {
  ROPSTEN = 3,
  MAIN = 1,
}

const providerOptions = {
  walletconnect: {
    package: WalletConnectProvider, // required
    options: {
      infuraId: INFURA_ID, // required
    },
  },
};

export default class WallectConnect {
  public account: string = '';
  public provider?: Ethers.providers.Web3Provider;
  public walletConnectProvider?: WalletConnectProvider;
  public web3?: Web3;
  public web3Modal: Web3Modal;
  public connected: boolean = false;
  public balance?: number;

  constructor() {
    this.web3Modal = new Web3Modal({
      network: TEST_NETWORK ? 'ropsten' : 'mainnet',
      cacheProvider: true,
      providerOptions,
    });
    setInterval(this.loadWalletInfo, 10000);
    this.loadWalletInfo();
  }

  loadWalletInfo = async () => {
    if (this.account && this.web3) {
      try {
        this.balance = this.web3.utils.toDecimal(
          await this.web3.eth.getBalance(this.account)
        );
      } catch (e) {
        this.balance = 0;
      }
    }
  };

  connect = async () => {
    if (this.connected) {
      return;
    }

    try {
      const provider = await this.web3Modal.connect();
      this.provider = new Ethers.providers.Web3Provider(provider);
      this.web3 = new Web3(provider);
      this.initProvider();
      this.loadWalletInfo();
    } catch (error) {
      console.error(error);
    }
  };

  reconnect = async () => {
    if (this.web3Modal.cachedProvider) {
      try {
        const provider = await this.web3Modal.connect();
        this.provider = new Ethers.providers.Web3Provider(provider);
        await this.initProvider();
        await this.loadWalletInfo();
        return true;
      } catch (e) {
        console.log(e);
      }
    }
    return false;
  };

  reset = async () => {
    this.web3Modal.clearCachedProvider();
    this.web3 = undefined;
    this.provider = undefined;
    localStorage.removeItem('walletconnect');
    this.connected = false;
  };

  initProvider = async () => {
    if (!this.provider) {
      return;
    }

    if (
      (await this.provider.getNetwork()).chainId !==
      (TEST_NETWORK ? EtherChainId.ROPSTEN : EtherChainId.MAIN)
    ) {
      // 3 = ropsten, 1 = mainnet
      alert(`Please switch to ${TEST_NETWORK ? 'Ropsten' : 'Mainnet'} network`);
      this.provider = undefined;
      return;
    }

    this.provider.on('accountsChange', () => this.reset());
    this.provider.on('chainChanged', () => this.reset());
    this.provider.on('disconnect', () => this.reset());

    const account = (await this.provider.listAccounts())[0];
    this.account = account;
    this.connected = true;
    alert(this.account);
  };

  erc721contract = async () => {
    if (!this.provider) {
      return;
    }

    return new Ethers.Contract(
      CHAIN_ADDRESS,
      ABI_ERC721,
      this.provider.getSigner()
    );
  };

  signMessage = async (rawMessage: string) => {
    if (this.walletConnectProvider) {
      const rawMessageLength = new Blob([rawMessage]).size;
      const bytesMessage = Ethers.utils.toUtf8Bytes(
        `\x19Ethereum Signed Message:\n${rawMessageLength}${rawMessage}`
      );
      const message = Ethers.utils.keccak256(bytesMessage);
      const params = [
        await this.walletConnectProvider.getSigner().getAddress(),
        message,
      ];
      return await this.walletConnectProvider.connector.signMessage(params);
    } else {
      return await this.provider?.getSigner().signMessage(rawMessage);
    }
  };
}
