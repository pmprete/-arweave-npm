#!/bin/bash
cd verdaccio-arweave && npm i && npm run build && cd ..
docker build .
V_PATH=$(pwd) && \
docker run -it --rm --name verdaccio \
  -p 4873:4873 \
  -v $V_PATH/verdaccio-docker/conf:/verdaccio/conf \
  -v $V_PATH/verdaccio-docker/storage:/verdaccio/storage \
  -v $V_PATH/verdaccio-arweave:/verdaccio/plugins/verdaccio-arweave \
  verdaccio/verdaccio