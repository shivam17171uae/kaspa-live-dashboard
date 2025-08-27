# Kaspa Live Dashboard

A full-stack, real-time dashboard for the Kaspa network, providing live market data, on-chain statistics, and a wallet inspection tool. The application stack is containerized with Docker for easy setup and connects to a locally running Kaspa node.

<img width="2810" height="1907" alt="Screenshot 2025-08-27 151905" src="https://github.com/user-attachments/assets/476fc0d7-0d7e-4445-95f1-a47144bfda4c" />


---

## Features

-   **Live Market Stats:** Fetches and displays real-time KAS price, 24h change, market cap, and volume from the CoinGecko API.
-   **Live Network Stats:** Connects directly to your local Kaspa node to show the current DAA score, network hashrate, circulating supply, and live peer count.
-   **Real-Time Throughput:** A dynamic chart that visualizes the network's Blocks Per Second (BPS) and Transactions Per Second (TPS).
-   **Live Block Feed:** Uses a WebSocket to display new blocks the moment they are found by the node.
-   **Wallet Address Checker:** Allows you to query any Kaspa address to see its current balance and a list of recent incoming transactions.

## Technical Architecture

-   **Frontend:** A responsive single-page application built with vanilla HTML, CSS, and JavaScript (using Chart.js). Served by an **Nginx** container.
-   **Backend:** A **Node.js** and **Express** API that communicates with the local Kaspa node via gRPC and serves data to the frontend.
-   **Indexer:** A separate **Node.js** script that listens for new blocks and saves all incoming transactions to the database for fast lookups.
-   **Database:** A **PostgreSQL** database, managed by the **Prisma ORM**, to store transaction data.
-   **Containerization:** The application stack (backend, frontend, database, indexer) is managed by **Docker** and **Docker Compose**.
-   **Data Source:** Connects to a `kaspad.exe` process running on the host machine.

---

## Getting Started

Follow these instructions to get the dashboard running on your local machine.

### Prerequisites

You must have the following software installed on your computer:
-   [Git](https://git-scm.com/downloads)
-   [Docker Desktop](https://www.docker.com/products/docker-desktop/)
-   A **Kaspa Full Node** (`kaspad`) executable. You can download the latest official release from the [Kaspa GitHub Releases Page](https://github.com/kaspanet/kaspad/releases).

### How to Run the Application

**Step 1: Clone the Repository**
```bash
git clone https://github.com/your-username/kaspa-live-dashboard.git
cd kaspa-live-dashboard

Step 2: Start Your Local Kaspa Node
Open a separate, dedicated terminal for your Kaspa node. Navigate to the folder containing your kaspad.exe file and run the following command.
The --utxoindex flag is required for the wallet checker to function. The --rpclisten=0.0.0.0 flag is essential to allow the Docker containers to connect to your node.

.\kaspad.exe --utxoindex --rpcmaxclients=250 --rpclisten=0.0.0.0

Leave this terminal running. It is the data source for the entire dashboard.
Step 3: Build and Launch the Docker Application
In your project terminal (kaspa-live-dashboard), run this command to build the application images and start all the containers.

code

docker-compose up --build -d
Step 4: One-Time Database Setup
The very first time you launch the application, you must create the tables in the database. Run this command in your project terminal:
code

docker-compose exec backend npx prisma db push
You will only need to do this once. The database will be persistent in a Docker volume for all future runs.

Step 5: Access the Dashboard

Open your web browser and go to: http://localhost:8085
The dashboard will be fully functional as soon as your local Kaspa node is synced with the network.
Common Commands

Start the application (after initial setup):

code

docker-compose up -d

Stop the application:

code

docker-compose down

View logs for all services:

code

docker-compose logs -f

View logs for the backend:
code

docker-compose logs -f backend

Clean up all unused Docker resources:

code

docker system prune
