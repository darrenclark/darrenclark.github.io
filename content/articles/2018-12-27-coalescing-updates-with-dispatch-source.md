---
title: "Coalescing Updates With Dispatch Sources"
date: 2018-12-27T18:27:36+00:00
tags: [ios,swift,grand-central-dispatch]
draft: false
summary: "Today we use <code>DispatchSourceUserDataAdd</code> to coalesce calls to <code>UITableView.reloadData()</code>"
---

Today I wanted to look at using `DispatchSourceUserDataAdd` to coalesce calls to (potentially expensive) functions like `UITableView.reloadData()`.

If you want to follow along in Xcode, feel free to copy/paste [this gist](https://gist.github.com/darrenclark/fa32cb5953ae6ccca16366b44098101a) into an iOS Playground.

## Background

<center>
<img src="/images/2018-12-27-todo-list.png" alt="App screenshot" style="max-width: 280" />
</center>

The example follows the patterns described in Apple's documentation on [Model-View-Controller](https://developer.apple.com/library/archive/documentation/General/Conceptual/DevPedia-CocoaCore/MVC.html).

Our "Model" layer is compromised of the `TodoList` and `TodoListItem` classes.  In reaction to user input, we can mark items as completed by setting the `TodoListItem.completed` property to `true`.  And, we can listen for changes by observing the `TodoListItemUpdated` notification.

```swift
class TodoList {
  static let shared = TodoList()

  var items: [TodoListItem] = [ /*...*/ ]

  // ...
}

extension NSNotification.Name {
  static let todoListItemUpdated = NSNotification.Name("TodoListItemUpdated")
}

class TodoListItem {
  let title: String

  var completed: Bool = false {
    didSet {
      NotificationCenter.default.post(name: .todoListItemUpdated, object: self)
    }
  }

  // ...
}
```

Our "Controller" layer is a subclass of `UITableViewController`.  It gets data from our model (`TodoList`) and displays it in a table view.

```swift
class ViewController: UITableViewController {
  // ...

  override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
    return TodoList.shared.items.count
  }

  override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
    let cell = tableView.dequeueReusableCell(withIdentifier: "Cell", for: indexPath)
    let item = TodoList.shared.items[indexPath.row]
    // configure cell ...
    return cell
  }
  
  // ...
}
```

When a user taps an item, we [toggle](https://github.com/apple/swift-evolution/blob/master/proposals/0199-bool-toggle.md) its `completed` property.

```swift
  override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
    TodoList.shared.items[indexPath.row].completed.toggle()
  }
```

In turn, the `TodoListItem` posts the `TodoListItemUpdated` notification, and our view controller reloads our table view, updating the UI for the user.

```swift
class ViewController: UITableViewController {

  override func viewDidLoad() {
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(todoListItemUpdated),
      name: .todoListItemUpdated,
      object: nil
    )

    // ...
  }

  @objc func todoListItemUpdated() {
    tableView.reloadData()
  }

}
```

And everything works great.  Since our `ViewController` observes changes to our model layer directly (via `NotificationCenter`), we never have to worry about our UI getting out of sync with our data.

As a convenience to our users, we decide to add a shortcut to mark all items as completed.  Firstly, we update our `TodoList` class with a function to mark all items completed.

```swift
class TodoList {
  // ...

  func markAllAsCompleted() {
    for item in items {
      item.completed = true
    }
  }
}
```

And wire up a button to call `markAllAsCompleted()`.

```swift
class ViewController: UITableViewController {
  override func viewDidLoad() {
    navigationItem.rightBarButtonItem = UIBarButtonItem(
      title: "Complete All",
      style: .plain,
      target: self,
      action: #selector(completeAll)
    )

    // ...
  }

  @objc func completeAll() {
    TodoList.shared.markAllAsCompleted()
  }

  // ...
}
```

Since our `ViewController` observes changes to our model via `NotificationCenter`, it automatically updates the UI in response to the user tapping the 'Complete All' button.

## The Problem

Some of you may have already noticed one small issue.

1. The `markAllAsCompleted()` function sets `completed = true` on all of our `TodoListItem`s
2. Each `TodoListItem` posts a `TodoListItemUpdated` notification
3. For each `TodoListItemUpdated` notification, our `ViewController` calls `tableView.reloadData()`

To confirm this, I've added a `print` statement when `tableView.reloadData()` is called.

<center>
<img src="/images/2018-12-27-broken.png" alt="Xcode screenshot demonstrating the bug" style="max-width: 100%" />
</center>

Sure enough!  Tapping 'Complete All' printed out five messages, one for each item we have.

Perhaps not a big issue if we have one, two, or even five items, but it could be if we have fifty or one hundred items.  While our code is simple and fairly straightforward, we are unnecessary calling `tableView.reloadData()` a lot!  We should take a look into this before shipping our app.

## The Solution

Ideally we want to coalesce all of changes into a single call to `tableView.reloadData()`.  Thankfully, Grand Central Dispatch provides us the perfect tool for the job - [`DispatchSourceUserDataAdd`](https://developer.apple.com/documentation/dispatch/dispatchsourceuserdataadd).

### Dispatch Sources

Dispatch Sources are special objects that schedule blocks to run when certain low level events happen.  For example, [`DispatchSourceSignal`](https://developer.apple.com/documentation/dispatch/dispatchsourcesignal) will enqueue a block on a given `DispatchQueue` when the current process receives certain Unix signals.  As many of these are wrapped up in higher level APIs in `Foundation.framework` or elsewhere, it's pretty rare to use Dispatch Sources directly.  However, there are a couple Dispatch Sources that are quite useful for us:

- [`DispatchSourceUserDataAdd`](https://developer.apple.com/documentation/dispatch/dispatchsourceuserdataadd)
- [`DispatchSourceUserDataOr`](https://developer.apple.com/documentation/dispatch/dispatchsourceuserdataor)
- [`DispatchSourceUserDataReplace`](https://developer.apple.com/documentation/dispatch/dispatchsourceuserdatareplace) - at the time of this writing, this one isn't documented in the [Objective-C documentation](https://developer.apple.com/documentation/dispatch/dispatch_source_type_constants?language=objc)

All three of these operate in roughly the same way:

- They all store a `UInt` *user data*
- The *user data* can be manipulated by us (the user of this API) via these methods (respectively):
    - `func add(data: UInt)` - increments the *user data* by `data`
    - `func merge(data: UInt)` - bitwise ORs the *user data* with `data`
    - `func replace(data: UInt)` - sets the *user data* to `data`
- When the *user data* becomes non-zero, it enqueues a block to run on a Dispatch Queue
- After the block is run, the *user data* is set back to zero

Of particular interest to us is the fact that a block is only enqueued when the *user data* becomes non-zero, not each time it is updated. 

### Using `DispatchSourceUserDataAdd`

Despite being advertised as "low-level", `DispatchSourceUserDataAdd` is fairly straightforward.  First we create one via the `DispatchSource.makeUserDataAddSource(queue:)` function.  We'll put this in our `ViewController` class.

```swift
class ViewController: UITableViewController {
  let dispatchSource = DispatchSource.makeUserDataAddSource(queue: .main)
   
  // ...
```

Then we need to set an event handler, a.k.a. the block that will be queued when the *user data* becomes non-zero.

After that, we'll call `dispatchSource.resume()` to "start" the dispatch source (by default, dispatch sources started in a suspended state)

```swift
class ViewController: UITableViewController {
  let dispatchSource = DispatchSource.makeUserDataAddSource(queue: .main)

  override func viewDidLoad() {

    dispatchSource.setEventHandler(handler: { [weak self] in
      print("tableView.reloadData()")
      self?.tableView.reloadData()
    })
    dispatchSource.resume()

    // ...
  }
```

Finally, we update our `todoListItemUpdated()` function to use the dispatch source instead of calling `tableView.reloadData()` directly.

```swift
class ViewController: UITableViewController {

  // ...

  @objc func todoListItemUpdated() {
    // Previously:
    //
    //  print("tableView.reloadData()")
    //  tableView.reloadData()

    dispatchSource.add(data: 1)
  }
```

Let's give this a go in Xcode...

<center>
<img src="/images/2018-12-27-fixed.png" alt="Xcode screenshot demonstrating that the bug is fixed" style="max-width: 100%" />
</center>

Perfect! Our code only called `tableView.reloadData()` once, despite getting five `TodoListItemUpdated` notifications.

## Final Thoughts

I've put the final code up in [this gist](https://gist.github.com/darrenclark/7f8ef59097aa7ee7e6f79d301fac8ec0).

Before using this elsewhere in our app, we may want to extract this into an extension, base class, or even another class to make it a little more ergonomic.  Rather than calling a function like `add(data: 1)` to signal a `reloadData()` is needed, it'd be much nicer to call a function named `setNeedsReloadData()` or similar.

Also, depending on our use cases, we might want to take a look at `DispatchSourceUserDataOr`.  Since it combines data together via a bitwise OR, we could use a bitmask to signal different types of updates are needed, rather than doing a full `reloadData()` each time.

Finally, I'd encourage you to read over [Apple's Dispatch documentation](https://developer.apple.com/documentation/DISPATCH), Grand Central Dispatch has quite a few interesting APIs in it.

