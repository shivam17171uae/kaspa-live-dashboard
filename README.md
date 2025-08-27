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
