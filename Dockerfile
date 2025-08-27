# Dockerfile
# Use an official Node.js runtime as the base image
FROM node:18-alpine AS builder

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to leverage Docker cache
COPY package*.json ./

# Install project dependencies
RUN npm install

# Copy prisma schema
COPY ./prisma ./prisma/

# Generate the Prisma client
RUN npx prisma generate

# Copy the rest of the application source code
COPY . .

# --- Final Image ---
FROM node:18-alpine
WORKDIR /usr/src/app

# Copy dependencies and prisma client from the builder stage
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/prisma ./prisma
COPY --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma

# Copy application code
COPY . .

# The command to run the application will be specified in docker-compose.yml