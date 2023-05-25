import {ethers} from "ethers";
import * as dotenv from 'dotenv'
import {hexlify} from "ethers/lib/utils.js";
import {readFileSync} from "fs";
import {createApi} from "./common.js";

dotenv.config()

/**
 * Returns Merkle proof for the particular data.
 *
 * @param availApi Api instance
 * @param hashBlock Hash of the block
 * @param dataIndex Leaf index in the merkle trie fot which the proof is returned
 * @returns {Promise<*>}
 */
async function getProof(availApi, hashBlock, dataIndex) {
    const daHeader = await availApi.rpc.kate.queryDataProof(dataIndex, hashBlock);
    console.log(`Fetched proof from Avail for txn index ${dataIndex} inside block ${hashBlock}`);
    return daHeader;
}

/**
 * Checks if the provided Merkle proof is valid by checking on the Ethereum deployed validation contract.
 *
 * @param sepoliaApi Sepolia network api instance
 * @param blockNumber Avail block number
 * @param proof Merkle proof fot the leaf
 * @param numberOfLeaves Number of leaves in the original tree
 * @param leafIndex Index of the leaf in the Merkle tree
 * @param leafHash Hash of the leaf in the Merkle tree
 * @returns {Promise<*>}
 */
async function checkProof(sepoliaApi, blockNumber, proof, numberOfLeaves, leafIndex, leafHash) {
    const abi = JSON.parse(readFileSync(process.env.VALIDIYM_ABI_PATH).toString());
    const availContract = new ethers.Contract(process.env.VALIDIUM_ADDRESS, abi, sepoliaApi);
    return await availContract.checkDataRootMembership(BigInt(blockNumber), proof, BigInt(numberOfLeaves), BigInt(leafIndex), "0x63cd0ce830dcc00e53239b1f203a33f554514f09ab5a20cd5fc8ed9d0b5383f1")
}

(async function submitProof() {
    const sepoliaApi = new ethers.providers.getDefaultProvider("sepolia")
    const availApi = await createApi(process.env.AVAIL_RPC);

    console.log(`Getting proof for data index ${process.env.DATA_INDEX} block number ${process.env.BLOCK_NUMBER} and block hash ${process.env.BLOCK_HASH}`)
    const daHeader = await getProof(availApi, process.env.BLOCK_HASH, process.env.DATA_INDEX)

    console.log(`Data Root: ${hexlify(daHeader.root)}`);
    console.log(`Proof: ${daHeader.proof}`);
    console.log(`Leaf to prove: ${hexlify(daHeader.leaf)}`);
    console.log(`Leaf index : ${daHeader.leaf_index}`);
    console.log(`Number of leaves: ${daHeader.numberOfLeaves}`);

    const isDataAccepted = await checkProof(sepoliaApi, process.env.BLOCK_NUMBER, daHeader.proof, daHeader.numberOfLeaves, daHeader.leaf_index, daHeader.leaf);
    console.log("Data is: " + (isDataAccepted ? "available" : "not available"));

    await availApi.disconnect();
})().then(() => {
    console.log("Done")
}).catch((err) => {
    console.error(err);
    process.exit(1);
});
