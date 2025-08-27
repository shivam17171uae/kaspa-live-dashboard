# Kaspa Live Dashboard

A real-time dashboard for monitoring the Kaspa network, powered by a direct connection to your own local Kaspa node. This dashboard provides live network statistics, a streaming block feed, and a wallet checker to view balances and transaction histories.

<img width="2714" height="1917" alt="Screenshot 2025-08-27 215151" src="https://github.com/user-attachments/assets/19ae9a17-a6eb-4b2c-9a30-4faee642b8f1" />


## Features

-   **Live Network Stats:** Monitors DAA Score, Hashrate, Circulating Supply, and Peer Count in real-time.
-   **Live Throughput Chart:** Visualizes Blocks Per Second (BPS) and Transactions Per Second (TPS).
-   **Streaming Block Feed:** Displays new blocks as they are discovered by your node, with clickable links to view block details.
-   **Wallet Address Checker:** Look up any Kaspa address to see its current balance and a paginated list of its transaction history (both sent and received).
-   **Market Stats:** Fetches current KAS price, 24h change, market cap, and volume from CoinGecko.

## Prerequisites

-   **A running `kaspad` node:** This dashboard requires a connection to a local Kaspa node. Ensure it is running and accessible.
-   **Docker and Docker Compose:** The application is containerized for easy setup and deployment.

## How to Run

This project is designed to be run with Docker Compose, which handles both the backend API and the frontend service.

#### 1. Configure the Environment

First, create a `.env` file in the root of the project directory. This file will store the connection details for your Kaspa node.

```
# .env
KASPAD_HOST=host.docker.internal:16110
```

_Note: `host.docker.internal` is a special DNS name that allows the Docker container to connect to services running on your host machine._

#### 2. Build and Run the Containers

Open your terminal in the project's root directory and run the following command:

```bash
docker-compose up --build -d
```

-   `--build` tells Docker Compose to rebuild the images if there are any changes (like in the Dockerfile).
-   `-d` runs the containers in detached mode, so they run in the background.

#### 3. Access the Dashboard

Once the containers are running, you can access the Kaspa Live Dashboard in your web browser at:

**[http://localhost:8085](http://localhost:8085)**

_(The port `8085` is defined in the `docker-compose.yml` file for the frontend service.)_

#### 4. To Stop the Application

To stop the containers, run:

```bash
docker-compose down
```

## Project Structure

The backend code has been refactored into a modular structure for better maintainability and scalability.

-   **`server.js`**: The main entry point for the backend application. It initializes the Express server, connects the routes, and starts the WebSocket service.
-   **`/routes/api.js`**: Defines all the HTTP API endpoints (e.g., `/api/address/:address`, `/api/market-stats`).
-   **`/services/kaspa-node.js`**: Manages the gRPC client and connection to the `kaspad` node. All direct node communication logic resides here.
-   **`/services/websocket.js`**: Manages the WebSocket server, including broadcasting new block notifications to all connected clients.
-   **`/src/`**: Contains all frontend files (`index.html`, `script.js`, `style.css`).

This structure separates concerns, making it easier to add new features or debug existing ones.
