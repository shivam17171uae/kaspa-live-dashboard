# Kaspa Live Dashboard

A full-stack, real-time dashboard for the Kaspa network, providing live market data, on-chain statistics, and a wallet inspection tool. The entire application is containerized with Docker for easy, one-command setup and portability.

![Kaspa Live Dashboard Screenshot](https-github-com-shivam-kaspa-live-dashboard-blob-main-screenshot-png) 
*(**Action Required:** Replace this with a link to a screenshot of your running dashboard!)*

---

## Features

-   **Live Market Stats:** Fetches and displays real-time KAS price, 24h change, market cap, and volume from the CoinGecko API.
-   **Live Network Stats:** Connects directly to a Kaspa node to show the current DAA score, network hashrate, circulating supply, and live peer count.
-   **Real-Time Throughput:** A dynamic chart that visualizes the network's Blocks Per Second (BPS) and Transactions Per Second (TPS).
-   **Live Block Feed:** Uses a WebSocket to display new blocks the moment they are found by the node.
-   **Wallet Address Checker:** Allows you to query any Kaspa address to see its current balance and a list of recent incoming transactions.

## Technical Architecture

-   **Frontend:** A responsive single-page application built with vanilla HTML, CSS, and JavaScript (using Chart.js for graphing). Served by an **Nginx** container.
-   **Backend:** A **Node.js** and **Express** API that acts as the central hub, communicating with the Kaspa node via gRPC and serving data to the frontend.
-   **Indexer:** A separate **Node.js** script that listens for new blocks and saves all incoming transactions to the database for fast lookups.
-   **Database:** A **PostgreSQL** database, managed by the **Prisma ORM**, to store transaction data.
-   **Containerization:** The entire application stack is managed by **Docker** and **Docker Compose** for a simple, one-command launch.

---

## Getting Started

Follow these instructions to get the dashboard running on your local machine.

### Prerequisites

You must have the following software installed on your computer:
-   [Git](https://git-scm.com/downloads)
-   [Docker Desktop](https://www.docker.com/products/docker-desktop/)

### Running the Application

There are two methods to run this project, depending on your needs. The "All-in-One" method is recommended for most users.

#### Option 1: The All-in-One Method (Recommended)

This method runs everything, including the Kaspa node itself, inside Docker. It is the most portable and easiest way to get started.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/kaspa-live-dashboard.git
    ```

2.  **Navigate into the project directory:**
    ```bash
    cd kaspa-live-dashboard
    ```

3.  **Build and Launch the Application:**
    This command will build the custom `kaspad` image and your application images, then start all containers in the background.
    ```bash
    docker-compose up --build -d
    ```

4.  **One-Time Database Setup:**
    The first time you launch the application, you must create the tables in the database. Run this command in your terminal:
    ```bash
    docker-compose exec backend npx prisma db push
    ```
    You will never need to run this command again unless you delete your database volume.

5.  **Access the Dashboard:**
    Open your web browser and go to: **`http://localhost:8085`**

**Important Note:** The first time you run this, the Kaspa node container needs to download and sync the entire blockchain. **This process can take several hours.** The dashboard will become fully functional once the node is synced. You can monitor the sync progress with the command: `docker-compose logs -f kaspad`.

---

#### Option 2: The Hybrid / Development Method

This method is for developers who want to run the Kaspa node manually on their host machine and connect the Dockerized application to it.

1.  **Clone the repository and navigate into the directory.**

2.  **Code Changes:**
    You must edit the `KASPAD_HOST` variable in `server.js` and `indexer.js` to point to your host machine from within Docker:
    ```javascript
    // Change from 'kaspad:16110' to:
    const KASPAD_HOST = 'host.docker.internal:16110';
    ```

3.  **Start Your Kaspa Node Manually:**
    Open a **separate terminal** and run your `kaspad.exe` with the necessary flags. The `--rpclisten=0.0.0.0` flag is essential to allow connections from Docker.
    ```powershell
    .\kaspad.exe --utxoindex --rpcmaxclients=250 --rpclisten=0.0.0.0
    ```
    Leave this terminal running.

4.  **Build and Launch the Application:**
    In your project terminal, run:
    ```bash
    docker-compose up --build -d
    ```

5.  **One-Time Database Setup:**
    ```bash
    docker-compose exec backend npx prisma db push
    ```

6.  **Access the Dashboard:**
    Open your web browser and go to: **`http://localhost:8085`**

---

### Common Commands

-   **Start the application (after initial setup):**
    ```bash
    docker-compose up -d
    ```
-   **Stop the application:**
    ```bash
    docker-compose down
    ```
-   **View logs for all services:**
    ```bash
    docker-compose logs -f
    ```
-   **View logs for a specific service (e.g., kaspad):**
    ```bash
    docker-compose logs -f kaspad
    ```
-   **Clean up all unused Docker resources:**
    ```bash
    docker system prune
    ```