FROM node:20-alpine

WORKDIR /app

# Install git as it's often needed for scaffolding or dependencies
RUN apk add --no-cache git

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
