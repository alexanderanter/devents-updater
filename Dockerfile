FROM node:8.11.3

# Install latest npm
RUN npm i -g npm

# Set home directory env variable and switch to node user, so we don't
# run as root
ENV HOME=/home/node
USER node

# Create app directory and copy package.json and package-lock.json to it
# Using --chown flag so that the new files are not owned by root
RUN mkdir $HOME/app
COPY --chown=node:node package.json package-lock.json $HOME/app/

# Switch working directory and install dependencies using npm ci, 
# which drastically lowers install time
WORKDIR $HOME/app
RUN npm ci

# Copies the rest of the app to the folder. Note a few things:
#
# In .dockerignore, node_modules/ is ignored and will not be copied,
# thus the local node_modules will not overwrite the container directory.
#
# In development mode, we mount the host directory to the container anyway,
# so this instruction is not needed. However, in staging/production, copying
# the source code to the container lets us deploy the application without
# checking out the source code, saving space and time.
COPY . .
