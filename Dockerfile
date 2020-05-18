FROM verdaccio/verdaccio

USER root

ENV NODE_ENV=production
RUN ls
RUN npm i

USER verdaccio