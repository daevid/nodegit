var assert = require("assert");
var path = require("path");
var Promise = require("nodegit-promise");
var promisify = require("promisify-node");
var fse = promisify(require("fs-extra"));
var local = path.join.bind(path, __dirname);

// Have to wrap exec, since it has a weird callback signature.
var exec = promisify(function(command, opts, callback) {
  return require("child_process").exec(command, opts, callback);
});

describe("Commit", function() {
  var NodeGit = require("../../");
  var Repository = NodeGit.Repository;

  var reposPath = local("../repos/workdir");
  var oid = "fce88902e66c72b5b93e75bdb5ae717038b221f6";

  function reinitialize(test) {
    return Repository.open(reposPath)
      .then(function(repository) {
        test.repository = repository;

        return repository.getCommit(oid);
      })
      .then(function(commit) {
        test.commit = commit;
      });
  }

  function undoCommit() {
    return exec("git reset --hard HEAD~1", {cwd: reposPath});
  }

  beforeEach(function() {
    return reinitialize(this);
  });

  it("will fail with an invalid sha", function() {
    return this.repository.getCommit("invalid").then(null, function(err) {
      assert.ok(err instanceof Error);
    });
  });

  it("has a message", function() {
    assert.equal(this.commit.message(), "Update README.md");
  });

  it("has a raw message", function() {
    assert.equal(this.commit.messageRaw(), "Update README.md");
  });

  it("has a message encoding", function() {
    var encoding = this.commit.messageEncoding();
    assert.ok(encoding === "UTF-8" || encoding === undefined);
  });

  it("has a summary", function() {
    assert.equal(this.commit.summary(), "Update README.md");
  });

  it("has a sha", function() {
    assert.equal(this.commit.sha(), oid);
  });

  it("has a time", function() {
    assert.equal(this.commit.timeMs(), 1362012884000);
  });

  it("has a date", function() {
    assert.equal(this.commit.date().getTime(), 1362012884000);
  });

  it("has a time offset", function() {
    assert.equal(this.commit.timeOffset(), 780);
  });

  it("can create a commit", function() {
    var test = this;
    var expectedCommitId = "315e77328ef596f3bc065d8ac6dd2c72c09de8a5";
    var fileName = "newfile.txt";
    var fileContent = "hello world";

    var repo;
    var index;
    var treeOid;
    var parent;

    return NodeGit.Repository.open(reposPath)
    .then(function(repoResult) {
      repo = repoResult;
      return fse.writeFile(path.join(repo.workdir(), fileName), fileContent);
    })
    .then(function() {
      return repo.openIndex();
    })
    .then(function(indexResult) {
      index = indexResult;
      return index.read(1);
    })
    .then(function() {
      return index.addByPath(fileName);
    })
    .then(function() {
      return index.write();
    })
    .then(function() {
      return index.writeTree();
    })
    .then(function(oidResult) {
      treeOid = oidResult;
      return NodeGit.Reference.nameToId(repo, "HEAD");
    })
    .then(function(head) {
      return repo.getCommit(head);
    })
    .then(function(parentResult) {
      parent = parentResult;
      return Promise.all([
        NodeGit.Signature.create("Foo Bar", "foo@bar.com", 123456789, 60),
        NodeGit.Signature.create("Foo A Bar", "foo@bar.com", 987654321, 90)
      ]);
    })
    .then(function(signatures) {
      var author = signatures[0];
      var committer = signatures[1];

      return repo.createCommit(
        "HEAD",
        author,
        committer,
        "message",
        treeOid,
        [parent]);
    })
    .then(function(commitId) {
      assert.equal(expectedCommitId, commitId);
      return undoCommit()
      .then(function(){
        return reinitialize(test);
      });
    }, function(reason) {
      return reinitialize(test)
        .then(function() {
          return Promise.reject(reason);
        });
    });
  });


  it("can amend commit", function(){
    var commitToAmendId = "315e77328ef596f3bc065d8ac6dd2c72c09de8a5";
    var expectedAmendedCommitId = "57836e96555243666ea74ea888310cc7c41d4613";
    var fileName = "newfile.txt";
    var fileContent = "hello world";
    var newFileName = "newerfile.txt";
    var newFileContent = "goodbye world";
    var messageEncoding = "US-ASCII";
    var message = "First commit";

    var repo;
    var index;
    var treeOid;
    var parent;
    var author;
    var committer;
    var amendedCommitId;

    return NodeGit.Repository.open(reposPath)
    .then(function(repoResult) {
      repo = repoResult;
      return fse.writeFile(path.join(repo.workdir(), fileName), fileContent);
    })
    .then(function() {
      return repo.openIndex();
    })
    .then(function(indexResult) {
      index = indexResult;
      return index.read(1);
    })
    .then(function() {
      return index.addByPath(fileName);
    })
    .then(function() {
      return index.write();
    })
    .then(function() {
      return index.writeTree();
    })
    .then(function(oidResult) {
      treeOid = oidResult;
      return NodeGit.Reference.nameToId(repo, "HEAD");
    })
    .then(function(head) {
      return repo.getCommit(head);
    })
    .then(function(parentResult) {
      parent = parentResult;
      return Promise.all([
        NodeGit.Signature.create("Foo Bar", "foo@bar.com", 123456789, 60),
        NodeGit.Signature.create("Foo A Bar", "foo@bar.com", 987654321, 90)
      ]);
    })
    .then(function(signatures) {
      var author = signatures[0];
      var committer = signatures[1];

      return repo.createCommit(
        "HEAD",
        author,
        committer,
        "message",
        treeOid,
        [parent]);
    })
    .then(function() {
      return fse.writeFile(
        path.join(repo.workdir(), newFileName),
        newFileContent
      );
    })
    .then(function() {
      return repo.openIndex();
    })
    .then(function(indexResult) {
      index = indexResult;
      return index.read(1);
    })
    .then(function() {
      return index.addByPath(newFileName);
    })
    .then(function() {
      return index.write();
    })
    .then(function() {
      return index.writeTree();
    })
    .then(function(resultOid){
      treeOid = resultOid;
       return Promise.all([
         repo.getCommit(commitToAmendId),
         NodeGit.Signature.create(
           "New Foo Bar",
           "newfoo@bar.com",
           246802468,
           12
         ),
         NodeGit.Signature.create(
           "New Foo A Bar",
           "newfoo@bar.com",
           4807891730,
           32
         )
       ]);

    })
    .then(function(amendInfo){
      var commit = amendInfo[0];
      author = amendInfo[1];
      committer = amendInfo[2];
      return commit.amend(
        "HEAD",
        author,
        committer,
        messageEncoding,
        message,
        treeOid
      );
    })
    .then(function(commitId){
      amendedCommitId = commitId;
      return undoCommit();
    })
    .then(function(){
      assert.equal(amendedCommitId, expectedAmendedCommitId);
    });
  });

  it("can amend commit and update reference separately", function() {
    var customReflogMessage = "updating reference manually";

    var head, repo, oid, originalReflogCount;

    return NodeGit.Repository.open(reposPath)
    .then(function(repoResult) {
      repo = repoResult;
      // grab the original reflog entry count (to make sure .amend
      // doesn't add a reflog entry when not given a reference)
      return NodeGit.Reflog.read(repo, "HEAD");
    })
    .then(function(reflog) {
      originalReflogCount = reflog.entrycount();
      // get the head reference and commit
      return repo.head();
    })
    .then(function(headResult) {
      head = headResult;
      return repo.getHeadCommit();
    })
    .then(function(headCommit) {
      // amend the commit but don't update any reference
      // (passing null as update_ref)
      return headCommit.amend(
        null,
        null,
        null,
        "message",
        null,
        null);
    }).then(function(oidResult) {
      oid = oidResult;
      // update the reference manually
      return head.setTarget(oid, customReflogMessage);
    }).then(function() {
      // load reflog and make sure the last message is what we expected
      return NodeGit.Reflog.read(repo, "HEAD");
    }).then(function(reflog) {
      var reflogEntry = reflog.entryByIndex(0);
      assert.equal(
        NodeGit.Reflog.entryMessage(reflogEntry),
        customReflogMessage
      );
      assert.equal(
        NodeGit.Reflog.entryIdNew(reflogEntry).toString(),
        oid
      );
      // only setTarget should have added to the entrycount
      assert.equal(reflog.entrycount(), originalReflogCount + 1);
    });
  });

  it("has an owner", function() {
    var owner = this.commit.owner();
    assert.ok(owner instanceof Repository);
  });

  it("can walk its repository's history", function(done) {
    var historyCount = 0;
    var expectedHistoryCount = 364;

    var history = this.commit.history();

    history.on("commit", function(commit) {
      historyCount++;
    });

    history.on("end", function(commits) {
      assert.equal(historyCount, expectedHistoryCount);
      assert.equal(commits.length, expectedHistoryCount);

      done();
    });

    history.on("error", function(err) {
      assert.ok(false);
    });

    history.start();
  });

  it("can fetch the master branch HEAD", function() {
    var repository = this.repository;

    return repository.getBranchCommit("master").then(function(commit) {
      return repository.getCommit(commit.sha());
    });
  });

  it("can fetch all of its parents", function() {
    return this.commit.getParents().then(function(parents) {
      assert.equal(parents.length, 1);

      var sha = parents[0].sha();
      assert.equal(sha, "ecfd36c80a3e9081f200dfda2391acadb56dac27");
    });
  });

  it("can specify a parents limit", function() {
    return this.commit.getParents(0).then(function(parents) {
      assert.equal(parents.length, 0);
    });
  });

  it("can specify limit higher than actual parents", function() {
    return this.commit.getParents(2).then(function(parents) {
      assert.equal(parents.length, 1);
    });
  });

  it("can fetch parents of a merge commit", function () {
    return NodeGit.Repository.open(reposPath)
    .then(function (repo) {
      return repo.getCommit("bf1da765e357a9b936d6d511f2c7b78e0de53632");
    })
    .then(function (commit) {
      return commit.getParents();
    })
    .then(function (parents) {
      assert.equal(parents.length, 2);
    });
  });

  it("has a parent count", function() {
    assert.equal(1, this.commit.parentcount());
  });

  it("can retrieve and walk a commit tree", function() {
    var commitTreeEntryCount = 0;
    var expectedCommitTreeEntryCount = 198;

    return this.commit.getTree().then(function(tree) {
      return new Promise(function(resolve, fail) {

        var treeWalker = tree.walk();

        treeWalker.on("entry", function(entry) {
          commitTreeEntryCount++;
        });

        treeWalker.on("error", function(error) {
          fail(error);
        });

        treeWalker.on("end", function(entries) {
          try {
            assert.equal(commitTreeEntryCount, expectedCommitTreeEntryCount);
            resolve();
          }
          catch (e) {
            fail(e);
          }
        });

        treeWalker.start();
      });
    });
  });

  it("can get the commit diff", function() {
    return this.commit.getDiff().then(function(diff) {
      assert.equal(diff.length, 1);
    });
  });

  describe("Commit's Author", function() {
    before(function() {
      this.author = this.commit.author();
    });

    it("is available", function() {
      assert.ok(this.author instanceof NodeGit.Signature);
    });

    it("has a name", function() {
      assert.equal(this.author.name(), "Michael Robinson");
    });

    it("has an email", function() {
      assert.equal(this.author.email(), "mike@panmedia.co.nz");
    });
  });

  describe("Commit's Committer", function() {
    before(function() {
      this.committer = this.commit.committer();
    });

    it("is available", function() {
      assert.ok(this.committer instanceof NodeGit.Signature);
    });

    it("has a name", function() {
      assert.equal(this.committer.name(), "Michael Robinson");
    });

    it("has an email", function() {
      assert.equal(this.committer.email(), "mike@panmedia.co.nz");
    });
  });
});
