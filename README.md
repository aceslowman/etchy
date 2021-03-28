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
Anyone can install a sphere on their own hosted server and allocate a set
amount of space. 
