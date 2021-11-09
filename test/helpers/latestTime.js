// Returns the time of the last mined block in seconds
export default async function latestTime (web3) {
  const data = await web3.eth.getBlock('latest')
  return data.timestamp
}
