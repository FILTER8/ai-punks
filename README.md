AI Punks: On-Chain AI NFT Agent with The Medalists
Project Overview
AI Punks is an innovative on-chain AI-powered NFT agent built on the Shape Mainnet (chain ID: 360), designed to revolutionize user interaction with blockchain-based digital art. The project introduces The Medalists, a unique NFT collection where each token serves as a key to unlock the AI Punks ecosystem. These Medalists are not just pixel art; they are functional tokens that enable collectors to interact with an AI agent to mint, explore, and navigate NFT collections in a dynamic, user-driven way.
The mission of AI Punks is to demonstrate the potential of on-chain AI agents in the Web3 space. By integrating minting, collection, and holder analytics functionalities, the project showcases how collectors can engage with the blockchain playfully and creatively. This is just the beginning—AI Punks aims to push the boundaries of on-chain art by enabling user-driven creation and interaction, leveraging the Shape ecosystem’s creative potential.
This project was developed for a hackathon, serving as a proof-of-concept for a new user experience that moves beyond static webpages to a collector-driven, interactive Web3 interface.
Features

Minting Medalists: Users can mint pixel art NFTs (The Medalists) directly on the Shape Mainnet for 0.003 ETH (0.0026 ETH mint price + 0.0004 ETH collector fee).
Collection Analytics: View total NFTs minted, unique holders, and network details for The Medalists collection.
Holder Insights: Check NFT ownership for a wallet address, including token IDs and images.
Top Holders: Identify the top holders (e.g., top 1 or top 3) of The Medalists collection.
Token Exploration: Retrieve details for specific token IDs or random Medalists, including traits and images.
AI Agent Interaction: A chat-based interface powered by an AI agent allows users to query the collection (e.g., “Show me my collection,” “Mint me 1 medalist”) and navigate the Web3 space.

Tech Stack

Frontend: Next.js, TypeScript, Tailwind CSS, React components (wagmi, @reown/appkit/react for wallet integration).
Backend: Node.js/Hardhat (mcp-server/) for smart contract interactions and API logic.
Blockchain: Shape Mainnet (chain ID: 360) with the NFT contract at 0x387ccF5d1c9928222dD4572dD4e3cd056513e3D6.
APIs: Custom API routes (app/api/*) for NFT minting, collection stats, and holder data, powered by mcp-server/ functions.

Getting Started
Prerequisites

Node.js: Version 18 or higher.
Wallet: A wallet (e.g., MetaMask) configured for Shape Mainnet (chain ID: 360, RPC URL: Shape Network docs).
ETH: At least 0.003 ETH per mint for testing on Shape Mainnet.

Installation

Clone the repository:
git clone https://github.com/FILTER8/ai-punks.git
cd ai-punks


Install dependencies:
npm install


Set up environment variables:

Create a .env.local file in the root directory:NEXT_PUBLIC_CONTRACT_ADDRESS=0x387ccF5d1c9928222dD4572dD4e3cd056513e3D6
NEXT_PUBLIC_API_URL=https://your-backend-api.com


Replace NEXT_PUBLIC_API_URL with the endpoint for mcp-server/ APIs (if external).


Run the development server:
npm run dev

Open http://localhost:3000 to view the app.

Test features:

Connect your wallet (Shape Mainnet).
Use chat commands like “Collection stats,” “Mint me 1 medalist,” or “Show me token id 3.”



Smart Contract Setup

The mcp-server/ directory includes a Hardhat project with NFTMinter.sol.
To compile contracts:cd mcp-server
npm install
npx hardhat compile



Current Status
This project is a hackathon prototype, demonstrating the core functionality of an on-chain AI NFT agent. It includes basic minting, collection analytics, and holder queries. Some known issues (e.g., errors in app/page.tsx, mcp-server/ files) are being addressed in ongoing development. The project successfully showcases a new user experience where collectors interact with the blockchain in a playful, AI-driven way.
Next Steps
AI Punks is just scratching the surface of what’s possible with on-chain AI agents. Future iterations will expand the project’s capabilities:

User-Driven Art Creation:

Enable users to influence pixel art creation through interactive inputs, with the final image assembled fully on-chain.
Store art data on-chain, combining user inputs to generate unique AiPunks, showcasing the Shape ecosystem’s creative potential.


Enhanced AI Agent:

Expand the AI’s capabilities to navigate the broader Web3 space, such as querying other NFT collections or blockchain data.
Integrate advanced AI models for dynamic responses and personalized collector experiences.


Improved User Experience:

Refine the chat interface with more intuitive commands and visual feedback.
Add support for multi-chain interactions beyond Shape Mainnet.


Scalability and Optimization:

Optimize mcp-server/ APIs for performance and reliability.
Address current errors (e.g., in app/page.tsx:152, mcp-server/get-collection-nft-count.ts:82) to ensure a robust deployment.


Community Engagement:

Open-source contributions to invite developers to enhance the AI agent and art creation features.
Create a community platform for collectors to share and showcase their Medalists.



Deployment
The project is deployed on Vercel and accessible via a public URL (to be updated post-hackathon). To deploy locally:

Install Vercel CLI:
npm install -g vercel


Deploy:
vercel


Add environment variables in Vercel:
vercel env add NEXT_PUBLIC_CONTRACT_ADDRESS
vercel env add NEXT_PUBLIC_API_URL



Contributing
We welcome contributions to AI Punks! To get involved:

Fork the repository and submit pull requests.
Report issues or suggest features via GitHub Issues.
Join the conversation about on-chain AI and NFT innovation.


Contact
For questions or collaboration, reach out via GitHub Issues or contact filter8 on twitter.

Built with 💻 and 🏅 for the hackathon, August 2025. Let’s unlock the future of Web3 with AI Punks!