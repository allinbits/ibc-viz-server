NAME=ibcgraph

build:
	docker build -t $(NAME) .

start: build
	docker run -d -p 80:80 $(NAME)

stop:
	docker stop $$(docker ps -q --filter ancestor=$(NAME))