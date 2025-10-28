FROM heroiclabs/nakama-pluginbuilder:3.32.0 AS builder

ENV GO111MODULE on
ENV CGO_ENABLED 1

WORKDIR /backend
COPY . .

RUN go build --trimpath --buildmode=plugin -o ./xoxo.so main2.go

FROM heroiclabs/nakama:3.32.0

COPY --from=builder /backend/xoxo.so /nakama/data/modules
COPY --from=builder /backend/local.yml /nakama/data/
COPY --from=builder /backend/*.json /nakama/data/modules
