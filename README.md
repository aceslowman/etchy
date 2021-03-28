# Public Sphere

## Basic Node Schema

```
{
  uuid: nanoid(),
  nickname: string,
  address: hash of global coordinate,
  broadcasting: boolean
}
```

Each node belongs to a _sphere_, which is the main social group. 
A node can point to any program that hooks into the API and it holds a small
amount of storage space on the sphere to store it's parameters and keep it in 
sync across the sphere.

Anyone can install a sphere on their own hosted server and allocate a set
amount of space (eg 1gb). The size of the sphere is proportional to the 
amount of storage available.

Each node on the sphere (server) occupies a small amount of personal storage.
A _garden_ is a reserved space for public storage, and the space you can take up 
in the garden is evenly distributed across all nodes within its range. The 
garden could be a public forum or just a shared space to store assets for an art 
project.
