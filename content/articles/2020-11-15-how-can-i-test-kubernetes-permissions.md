---
title: "How can I test Kubernetes permissions?"
date: 2020-11-15T11:27:38-05:00
tags: [kubernetes,rbac]
draft: false
summary: "Or, &ldquo;impersonating a service account with <code>kubectl</code> to verify permissions are correctly configured&rdquo;"
---

They say a `bash` one-liner is worth a thousand words, or something like that...

```bash
kubectl --as system:serviceaccount:default:myapp get pods
# Error from server (Forbidden): pods is forbidden: User 
# "system:serviceaccount:default:myapp" cannot list resource 
# "pods" in API group "" in the namespace "default"
```

---

Recently I found myself setting up a [Kubernetes service account](https://kubernetes.io/docs/tasks/configure-pod-container/configure-service-account/) to give my application read access to some Kubernetes resources.  Following the [principle of least privilege](https://en.wikipedia.org/wiki/Principle_of_least_privilege), I wanted to ensure my application had the absolute minimum access it needed.

As I prepared the Kubernetes YAML files, I wondered how I could test these locally before deploying.  Follow along below to see the process I used.

# Setting the Stage

First, we'll need a Kubernetes cluster to test on.

I'm going to use [`minikube`](https://minikube.sigs.k8s.io/docs/start/) to create a test cluster on my laptop, but any Kubernetes cluster will work.

```sh
minikube start
# 😄  minikube v1.15.0 on Darwin 10.15.5
# ✨  Automatically selected the docker driver. Other choices: hyperkit, virtualbox
# 👍  Starting control plane node minikube in cluster minikube
# .....
# 🏄  Done! kubectl is now configured to use "minikube" cluster and "default" namespace by default
```


# Meet Alice and Bob

We'll need two test subjects (pun intended).  I've put together a Kubernetes config that:

- Creates two service accounts, `alice` and `bob`
- Grants both `alice` and `bob` permissions to view [Kubernetes jobs](https://kubernetes.io/docs/concepts/workloads/controllers/job/)
- Grants `alice` permissions to create new jobs

You can [view the gist on Github](https://gist.github.com/darrenclark/1e0810a0e864efe9bb712d3d0dd991c7#file-service-accounts-and-permissions-yaml).  We'll apply it to our Minikube cluster:

```sh
kubectl apply -f https://gist.githubusercontent.com/darrenclark/1e0810a0e864efe9bb712d3d0dd991c7/raw/83458fdf93c3aea1be292506e28a26c73e68e9db/service-accounts-and-permissions.yaml
# serviceaccount/alice created
# serviceaccount/bob created
# role.rbac.authorization.k8s.io/jobs-viewer created
# role.rbac.authorization.k8s.io/jobs-manager created
# rolebinding.rbac.authorization.k8s.io/alice-and-bob-jobs-viewer created
# rolebinding.rbac.authorization.k8s.io/alice-jobs-manager created
```

# Testing out our permissions

Let's test out the permissions on our newly created service accounts.  Lucky for us, `kubectl` has the perfect tool for the job.  From the man page:

```
    --as=""      Username to impersonate for the operation
```

This allows us to run `kubectl` as if we were `alice` or `bob`.

We can use the Job definition in [this Gist](https://gist.github.com/darrenclark/1e0810a0e864efe9bb712d3d0dd991c7#file-job-yaml) to test it out.

### Testing `alice`'s permissions

Let's try creating a job with `alice`:

```sh
kubectl create \
  --as=system:serviceaccount:default:alice \
  -f https://gist.githubusercontent.com/darrenclark/1e0810a0e864efe9bb712d3d0dd991c7/raw/83458fdf93c3aea1be292506e28a26c73e68e9db/job.yaml
# job.batch/echo-job-jv8jh created
```

And viewing that job as `alice`:

```sh
kubectl --as=system:serviceaccount:default:alice get jobs
# NAME             COMPLETIONS   DURATION   AGE
# echo-job-jv8jh   1/1           3s         39s
```

No surprises here, as we granted `alice` read and write access to `jobs`.

### Testing `bob`'s permissions

Next, lets try viewing the job as `bob`:

```sh
kubectl --as=system:serviceaccount:default:bob get jobs
# NAME             COMPLETIONS   DURATION   AGE
# echo-job-jv8jh   1/1           3s         3m25s
```

Looks good.  What happens when we try to create a job as `bob`?

```sh
kubectl create \
  --as=system:serviceaccount:default:bob \
  -f https://gist.githubusercontent.com/darrenclark/1e0810a0e864efe9bb712d3d0dd991c7/raw/83458fdf93c3aea1be292506e28a26c73e68e9db/job.yaml
# Error from server (Forbidden): error when creating "https://gist.githubusercontent.com/darrenclark/1e0810a0e864efe9bb712d3d0dd991c7/raw/83458fdf93c3aea1be292506e28a26c73e68e9db/job.yaml":
# jobs.batch is forbidden: User "system:serviceaccount:default:bob" 
# cannot create resource "jobs" in API group "batch" in the namespace
# "default"
```

As we expected!  We gave `bob` read-only access to jobs, so it makes sense we got an error back.

---

I was quite happy to learn about the `--as` argument.  It made it _really_ easy to test the permissions for my service account, and I could be confident I was giving it the minimum required permissions.
