# Use the official Node.js 22 image
FROM node:22-slim

# Create and change to the app directory
WORKDIR /app

# Copy application dependency manifests
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy local code to the container image
COPY . .

# Build the frontend
RUN npm run build

# Expose the port the app runs on
EXPOSE 3000

# Run the web service on container startup
CMD [ "npm", "start" ]
