/**
 * One switch: set ACTIVE_NETWORK to "mainnet" once Squeekchain publishes a mainnet deployment.
 * Mainnet contract addresses are deliberately null: the docs publish none yet
 * (https://docs.squeekchain.com/developers/#deployments), and this site never guesses one.
 */
export type NetworkKey = "sepolia" | "mainnet";
export const ACTIVE_NETWORK: NetworkKey = "sepolia";

export interface NetworkConfig {
  label: string;
  chainId: string;
  apiBase: string;
  explorer: string;
  /** Addresses from the docs' deployment record, used only to warn when the API serves something else. */
  deploymentRecord: { core: string | null; mining: string | null; token: string | null; nft: string | null };
  /** SqueekMining REWARD_PER_BLOCK as quoted in the docs, in whole SQK. */
  docsRewardPerBlockSqk: number | null;
}

export const NETWORKS: Record<NetworkKey, NetworkConfig> = {
  sepolia: {
    label: "Sepolia",
    chainId: "11155111",
    apiBase: "https://api.squeekchain.com",
    explorer: "https://sepolia.etherscan.io",
    deploymentRecord: {
      core: "0x74665daeca35a2303e767e76a2ff1fb6f93e119f",
      mining: "0x3bee588fc20de788bac17d33b41da7346cb27ec4",
      token: "0x6872bfa5ccc3e9e440c6c16e5ffdabb8dba4cc76",
      nft: "0x0eaf3e0d40a0a8e5a6ac030b2459e9fb0b7905c6",
    },
    docsRewardPerBlockSqk: 5600,
  },
  mainnet: {
    label: "Ethereum",
    chainId: "1",
    apiBase: "https://api.squeekchain.com",
    explorer: "https://etherscan.io",
    deploymentRecord: { core: null, mining: null, token: null, nft: null },
    docsRewardPerBlockSqk: 6900,
  },
};

export const NET = NETWORKS[ACTIVE_NETWORK];
export const REFRESH_MS = 10_000;

const DOCS = "https://docs.squeekchain.com";
/** Doc sections every figure on the site links back to. */
export const DOC = {
  units: `${DOCS}/developers/api/#numbers-and-units`,
  caching: `${DOCS}/developers/api/#caching`,
  pagination: `${DOCS}/developers/api/#pagination`,
  status: `${DOCS}/developers/api/#status`,
  core: `${DOCS}/developers/api/#core`,
  settlements: `${DOCS}/developers/api/#settlements`,
  economy: `${DOCS}/developers/api/#economy-state`,
  account: `${DOCS}/developers/api/#account`,
  activity: `${DOCS}/developers/api/#account-activity`,
  squeek: `${DOCS}/developers/api/#squeek`,
  deployments: `${DOCS}/developers/#deployments`,
  share: `${DOCS}/squeeks/overview/#how-each-blocks-sqk-is-shared`,
  rewardCalc: `${DOCS}/developers/mining/#reward-calculation`,
  rewardPerBlock: `${DOCS}/developers/mining/#tldr`,
  issuance: `${DOCS}/rewards/creation/#how-much-sqk-does-each-block-issue`,
  merge: `${DOCS}/squeeks/merge/`,
  mergeRules: `${DOCS}/developers/mining/#merge`,
  levels: `${DOCS}/squeeks/power/#levels-and-maximum-power`,
  cooldown: `${DOCS}/squeeks/power/#when-can-you-merge-again`,
  newPower: `${DOCS}/squeeks/power/#when-does-new-power-start-earning`,
  staking: `${DOCS}/rewards/staking/`,
  home: `${DOCS}/`,
  genesis: "https://squeekchain.com/genesis",
};
