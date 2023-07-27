# Use an official Ubuntu runtime as a parent image
FROM ubuntu:latest

# Install dependencies
RUN apt-get update && \
    apt-get install -y curl gnupg && \
    curl -sL https://deb.nodesource.com/setup_14.x  | bash - && \
    apt-get install -y nodejs && \
    apt-get install -y git && \
    apt-get -y autoclean

# Install Chrome
RUN apt-get install -y wget && \
    wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb && \
    apt-get install -y ./google-chrome-stable_current_amd64.deb

# Set the working directory in the container to /app
WORKDIR /app

# Copy the current directory contents into the container at /app
COPY . /app

# Install any needed packages specified in package.json
RUN npm install

# Run app.js when the container launches
CMD ["node", "app.js"]
