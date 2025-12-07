---
title: "Commands, args, and ENTRYPOINTs in Kubernetes"
date: 2022-02-19T11:30:00-05:00
summary: What command will my container <i>actually</i> going to run?  Let's explore how Kubernetes decides which command to run.
tags: ["kubernetes"]
---

Perhaps one of the most perplexing parts of starting a Docker container in
Kubernetes is the variety of options for specifying the command to be run.

A `Dockerfile` can include one or both of `CMD` and `ENTRYPOINT` instructions:

```docker
FROM alpine
CMD ["echo", "hello, world!"]
```

```docker
FROM alpine
ENTRYPOINT ["echo"]
CMD ["hello, world!"]
```

```docker
FROM alpine
ENTRYPOINT ["echo", "hello, world!"]
```

Similarly, Kubernetes has `command` and `args` fields:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: hello-world
spec:
  containers:
  - name: hello-world
    image: alpine
    command: ["echo"]
    args: ["hello, world!"]
  restartPolicy: OnFailure
```

Frustratingly, the terminology doesn't quite line up between the two:

| | command | arguments |
|-|-|-|
| **Docker** | `ENTRYPOINT` | `CMD` |
| **Kubernetes** | `command` | `args` |

*NOTE: In the cases where `command` or `args` isn't set, Kubernetes will use
the equivalent instruction from the `Dockerfile`.*

Both 'command' and 'arguments' are lists.  As such, the 'command' portion can
include both the executable and some arguments.

| command | arguments | command run |
|-|-|-|
| `["echo"]` | `["hello", "world"]` | `echo hello world` |
| `["echo", "hello"]` | `["world"]` | `echo hello world` |

# Putting this to use

We can leverage these two fields to build Docker images that are easy to run
locally, yet are flexible when deployed.

In our `Dockerfile`, we'll use `ENTRYPOINT` to define the "base command" and
`CMD` to provide a set of default options.  When deploying this container,
we can override the default options by specifying `args` in our Kubernetes
manifests.

For example, here's a `Dockerfile` file using Python's
[bundled web server](https://docs.python.org/3/library/http.server.html):

```docker
FROM python:3-alpine

WORKDIR /site
COPY index.html ./

ENTRYPOINT ["python3", "-m", "http.server"]
CMD ["8000"]
```

We can build and run this locally:

```sh
docker build -t my-python-web-server:v1 .

# uses port 8000 from the Dockerfile
docker run -it -p8000:8000 my-python-web-server:v1

# and, we can override CMD to use a different port
docker run -it -p8123:8123 my-python-web-server:v1 8123
```

When we deploy this to Kubernetes, we can use `args` to easily set a port
to listen on:

*NOTE: using a [static Pod](https://kubernetes.io/docs/tasks/configure-pod-container/static-pod/)
for brevity, usually a [Deployment](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/) or similar would be used in a production environment.*

```yaml
# pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-python-web-server
spec:
  containers:
  - name: server
    image: my-python-web-server:v1
    args: ["8888"]
```

We can apply this and use `kubectl`'s port forwarding functionality to access
our web server:

```sh
kubectl apply -f pod.yaml

kubectl port-forward pods/my-python-web-server 8888:8888
```

# Wrapping up

By using this pattern, we've:

- provided a set of default options to run our image locally, and
- made it easy to override those defaults when running in Kubernetes

It should also be noted, this pattern works good for the above use case.  There
are many other uses cases for these parameters.
