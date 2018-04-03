FROM node:9.9-alpine

# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Copy package.json
COPY package.json /usr/src/app/

# Install app dependencies & build tools & cleanup (keep a light layer)
RUN npm install --silent --production

# Bundle app source
COPY . /usr/src/app

CMD [ "npm", "start" ]
