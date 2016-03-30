"use strict";

//chrome.storage.local.clear();

class PrivateTreeIntersection {

	constructor(options) {
		this.options = options || {};
		this.parser = new DOMParser();

		// This implementation is in the thesis report often referred to as "Strict PTI".
		this.findIntersectionTreeSlow = function(treeA, treeB) {
			// If the trees are identical, the intersection will be either of the trees, so we just return treeA.
			if (treeA.deepHash === treeB.deepHash) {
				return treeA;
			}

			// If the trees don't share shallow hashes, we won't know what to do with an intersection of the children anyway,
			// so we just declare that there's no intersection.
			if (treeA.shallowHash !== treeB.shallowHash) {
				return false;
			}

			// If treeA doesn't have any children, we may be able to return the root element itself as an intersection,
			// assuming the root element is the same (i.e. the shallowHashes are the same).
			if (treeA.children.length === 0) {
				if (treeA.shallowHash === treeB.shallowHash) {
					return treeA;
				}
				// If the shallow hashes differ and treeA has no children, there can't be any intersection at all.
				return false;
			}

			for (var i=0, l=treeA.children.length; i < l; ++i) {
				treeA.children[i].dirty = true;
				for (var j=0, k=treeB.children.length; j < k; ++j) {
					// We do not want multiple children of treeA matching the same child of treeB, so if the child has already
					// been matched, we ignore it.
					if (treeB.children[j].matched) {
						continue;
					}

					if (treeA.children[i].deepHash === treeB.children[j].deepHash) {
						treeA.children[i].dirty = false;
						treeB.children[j].matched = true;
						break;
					}

					var intersectionTree = this.findIntersectionTree(treeA.children[i], treeB.children[j]);
					if (intersectionTree) {
						treeA.children[i] = intersectionTree;
						treeA.children[i].dirty = false;
						treeB.children[j].matched = true;
						break;
					}
					treeA.children[i].dirty = true;
				}
			}

			return treeA;
		};

		// This implementation is in the thesis report often referred to as "Relaxed PTI".
		this.findIntersectionTreeFast = function(treeA, treeB) {
			// If the trees are identical, the intersection will be either of the trees, so we just return treeA.
			if (treeA.deepHash === treeB.deepHash) {
				return treeA;
			}

			// If the trees don't share shallow hashes, we won't know what to do with an intersection of the children anyway,
			// so we just declare that there's no intersection.
			if (treeA.shallowHash !== treeB.shallowHash) {
				return false;
			}

			// If treeA doesn't have any children, we may be able to return the root element itself as an intersection,
			// assuming the root element is the same (i.e. the shallowHashes are the same).
			if (treeA.children.length === 0) {
				if (treeA.shallowHash === treeB.shallowHash) {
					return treeA;
				}
				// If the shallow hashes differ and treeA has no children, there can't be any intersection at all.
				return false;
			}

			for (var i=0, l=treeA.children.length; i < l; ++i) {
				// If the child of treeA doesn't exist in treeB, it clearly can't be part of the intersection.
				if (!treeB.children[i]) {
					treeA.children[i].dirty = true;
					continue;
				}

				// If the hashes of the two elements are identical, it will be part of the intersection and we therefore won't
				// have to mark the child as dirty.
				if (treeA.children[i].deepHash === treeB.children[i].deepHash) {
					continue;
				}

				// If the root element of the child however doesn't match, the element clearly can't intersect at all. Even if
				// treeA and treeB would have common children, we wouldn't know how to organize them when the node they belong to
				// aren't the same.
				if (treeA.children[i].shallowHash !== treeB.children[i].shallowHash) {
					treeA.children[i].dirty = true;
					continue;
				}

				var intersectionTree = this.findIntersectionTree(treeA.children[i], treeB.children[i]);
				// Now the recursion starts. If there is no intersection at all, mark the root as dirty.
				if (!intersectionTree) {
					treeA.children[i].dirty = true;
					continue;
				}
				// On the other hand, if there is an intersection, let's keep it.
				treeA.children[i] = intersectionTree;
			}

			return treeA;
		};

		// State pattern
		this.currentFindIntersectionTree = this.options.fastMode ? this.findIntersectionTreeFast : this.findIntersectionTreeSlow;

	}

	getCleanDocument(docStringA, treeB) {
		console.time("getDocumentFromString");
		var docA = this.getDocumentFromString(docStringA);
		console.timeEnd("getDocumentFromString");

		console.time("getHashStructure");
		var treeA = this.getHashStructure(docA);
		console.timeEnd("getHashStructure");

		var intersectionTree = this.findIntersectionTree(treeA, treeB);

		if (!intersectionTree) {
			return "";
		}

		console.time("findDirtyLeafs");
		var dirtyLeafs = this.findDirtyLeafs(intersectionTree);
		console.timeEnd("findDirtyLeafs");

		console.time("deleteDirtyLeafs");
		var cleanDoc = this.deleteDirtyLeafs(docA, dirtyLeafs);
		console.timeEnd("deleteDirtyLeafs");

		return cleanDoc.all[0].outerHTML;
	}

	getHashStructure(doc) {
		function traverse(element) {
			var shallowElement = element.cloneNode(true);
			while (shallowElement.firstElementChild) {
				shallowElement.removeChild(shallowElement.firstElementChild);
			}

			// We have to empty innerHTML, otherwise some linebreaks may remain, etc., causing two otherwise identical
			// elements to get different hashes. For instance, if one element had three children, the shallow element may be
			// <div id="test">\n\n</div>, whereas an element with only two children would generate <div id="test">\n</div>.
			// Once the children have been removed, obviously these ought to be identical.
			shallowElement.innerHTML = shallowElement.innerHTML.trim();
			var shallowHash = md5(shallowElement.outerHTML);
			var deepHash = md5(element.outerHTML);
			var children = [];
			for (var i=0, l=element.children.length; i < l; ++i) {
				children.push(traverse(element.children[i]));
			}
			return {
				shallowHash: shallowHash,
				deepHash: deepHash,
				children: children,
				element: shallowElement
			};
		}
		return traverse(doc.children[0]);
	}

	getDocumentFromString(docString) {
		return this.parser.parseFromString(docString, "text/html");
	}

	findIntersectionTree(treeA, treeB) {
		return this.currentFindIntersectionTree(treeA, treeB);
	}

	findDirtyLeafs(structure) {
		var dirtyPaths = [];
		function traverse(structure, level) {
			if (structure.dirty) {
				dirtyPaths.push(level);
			}
			for (var i=0, l=structure.children.length; i < l; ++i) {
				var nextLevel = level.slice();
				nextLevel.push(i);
				traverse(structure.children[i], nextLevel);
			}
		}
		traverse(structure, []);
		return dirtyPaths;
	}

	deleteDirtyLeafs(doc, dirtyLeafs) {
		/*
			We have to iterate from the back, so we don't screw up indices. Imagine a scenario with 3 elements A, B and C.
			We need to delete element B anc C, which have index 1 and 2. Now, if we delete element B, element C takes its
			place in the list, so C now has index 1. Next up, we now have to delete index C, which we believe is at position
			2, but it's not anymore. If we delete from the bottom up, we don't have this problem.
		*/
		for (var i=dirtyLeafs.length; i > 0; --i) {
			var element = doc.children[0];
			for (var j=0, m=dirtyLeafs[i-1].length; j < m; ++j) {
				element = element.children[dirtyLeafs[i-1][j]];
			}
			element.parentNode.removeChild(element);
		}
		return doc;
	}

}