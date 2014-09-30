/**
 * @license
 * Copyright 2014 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
goog.setTestOnly();

goog.require('goog.string');
goog.require('goog.structs.Set');
goog.require('goog.testing.PropertyReplacer');
goog.require('goog.testing.jsunit');
goog.require('lf.Row');
goog.require('lf.index.BTree');
goog.require('lf.index.KeyRange');
goog.require('lf.testing.index.TestSingleRowNumericalKey');
goog.require('lf.testing.index.TestSingleRowStringKey');


/** @type {!goog.testing.PropertyReplacer} */
var stub;

function setUp() {
  // Replace the max count of B-Tree to 5 so that we verify the tree
  // construction algorithm.
  stub = new goog.testing.PropertyReplacer();
  stub.replace(
      goog.getObjectByName('lf.index.BTreeNode_'),
      'MAX_COUNT_',
      5);
  stub.replace(
      goog.getObjectByName('lf.index.BTreeNode_'),
      'MAX_KEY_LEN_',
      5 - 1);
  stub.replace(
      goog.getObjectByName('lf.index.BTreeNode_'),
      'MIN_KEY_LEN_',
      5 >> 1);
  stub.replace(
      goog.getObjectByName('lf.index.BTreeNode_'),
      'nodeCount_',
      0);
}


/** @const {!Array.<number>} */
var SEQUENCE = [
  13, 9, 21, 17,
  5,
  11, 3, 25, 27,
  14, 15, 31, 29, 22, 23, 38, 45, 47,
  49,
  1,
  10, 12, 16];


/**
 * @param {number} index
 * @return {!lf.index.BTree} The tree generated
 */
function insertToTree(index) {
  var tree = new lf.index.BTree('test', true);
  var i = 0;
  while (i < index) {
    tree.add(SEQUENCE[i], SEQUENCE[i]);
    i++;
  }
  return tree;
}

function testEmptyTree() {
  // Creating empty tree shall have no problem.
  var tree = insertToTree(0);
  var expected = '0[]\n_{}_\n';
  assertEquals(expected, tree.toString());
}

function testLeafNodeAsRoot() {
  var tree = insertToTree(4);
  var expected =
      '0[9|13|17|21]\n' +
      '_{9/13/17/21}_\n';
  assertEquals(expected, tree.toString());
}


/**
 * Splits the root node to form new root node.
 *
 * 9|13|17|21
 *
 * insert 5
 *
 *     13
 *    /  \
 *  5|9  13|17|21
 */
function testFirstInternalNode() {
  var tree = insertToTree(5);
  var expected =
      '2[13]\n' +
      '_{0|1}_\n' +
      '0[5|9]  1[13|17|21]\n' +
      '_{5/9}2  0{13/17/21}2\n';
  assertEquals(expected, tree.toString());
}


/**
 * Split of leaf node.
 *
 *        13
 *     /     \
 * 3|5|9|11  13|17|21|25
 *
 * insert 27
 *
 *          13|21
 *     /      |      \
 * 3|5|9|11  13|17   21|25|27
 */
function testSplit_Case1() {
  var tree = insertToTree(9);
  var expected =
      '2[13|21]\n' +
      '_{0|1|3}_\n' +
      '0[3|5|9|11]  1[13|17]  3[21|25|27]\n' +
      '_{3/5/9/11}2  0{13/17}2  1{21/25/27}2\n';
  assertEquals(expected, tree.toString());
}


/**
 * Split of leaf node inducing split of internal nodes and a new level.
 *
 *                        13|21|27|31
 *     /          /            |         \         \
 * 3|5|9|11  13|14|15|17  21|22|23|25  27|29  31|38|45|47
 *
 * insert 49
 *                              27
 *                 /                            \
 *              13|21                         31|45
 *     /          |            \          /     |      \
 * 3|5|9|11  13|14|15|17  21|22|23|25  27|29  31|38  45|47|49
 */
function testSplit_Case2() {
  var tree = insertToTree(19);
  var expected =
      '11[27]\n' +
      '_{2|12}_\n' +
      '2[13|21]  12[31|45]\n' +
      '_{0|1|3}11  2{5|7|9}11\n' +
      '0[3|5|9|11]  1[13|14|15|17]  3[21|22|23|25]' +
      '  5[27|29]  7[31|38]  9[45|47|49]\n' +
      '_{3/5/9/11}2  0{13/14/15/17}2  1{21/22/23/25}2' +
      '  3{27/29}12  5{31/38}12  7{45/47/49}12\n';
  assertEquals(expected, tree.toString());
}


/**
 * Split of leaf node promoting a new key in internal node.
 *
 *                              27
 *                 /                            \
 *              13|21                         31|45
 *     /          |            \          /     |      \
 * 3|5|9|11  13|14|15|17  21|22|23|25  27|29  31|38  45|47|49
 *
 * insert 1
 *                               27
 *               /                              \
 *            5|13|21                         31|45
 *  /      /         \            \          /     |      \
 * 1|3  5|9|11  13|14|15|17  21|22|23|25  27|29  31|38  45|47|49
 */
function testSplit_Case3() {
  var tree = insertToTree(20);
  var expected =
      '11[27]\n' +
      '_{2|12}_\n' +
      '2[5|13|21]  12[31|45]\n' +
      '_{0|13|1|3}11  2{5|7|9}11\n' +
      '0[1|3]  13[5|9|11]  1[13|14|15|17]  3[21|22|23|25]' +
      '  5[27|29]  7[31|38]  9[45|47|49]\n' +
      '_{1/3}2  0{5/9/11}2  13{13/14/15/17}2  1{21/22/23/25}2' +
      '  3{27/29}12  5{31/38}12  7{45/47/49}12\n';
  assertEquals(expected, tree.toString());
}


/**
 * Split of leaf node causing double promotion.
 *
 *                                 27
 *               /                                        \
 *          5|10|13|21                                  31|45
 *  /      /    |           \            \          /     |      \
 * 1|3  5|9  10|11|12  13|14|15|17  21|22|23|25  27|29  31|38  45|47|49
 *
 * insert 16
 *
 *                              13|27
 *               /                |                           \
 *      5|10                    15|21                       31|45
 *   /   |      \         /       |          \         /      |       \
 * 1|3  5|9  10|11|12  13|14  15|16|17  21|22|23|25  27|29  31|38  45|47|49
 */
function testSplit_Case4() {
  var tree = insertToTree(23);
  var expected =
      '11[13|27]\n' +
      '_{2|20|12}_\n' +
      '2[5|10]  20[15|21]  12[31|45]\n' +
      '_{0|13|15}11  2{1|17|3}11  20{5|7|9}11\n' +
      '0[1|3]  13[5|9]  15[10|11|12]  1[13|14]  17[15|16|17]  3[21|22|23|25]' +
      '  5[27|29]  7[31|38]  9[45|47|49]\n' +
      '_{1/3}2  0{5/9}2  13{10/11/12}2' +
      '  15{13/14}20  1{15/16/17}20  17{21/22/23/25}20' +
      '  3{27/29}12  5{31/38}12  7{45/47/49}12\n';
  assertEquals(expected, tree.toString());
}


/**
 * Tests split leaf and internal which have links to the right.
 *
 *                               363
 *             /                                     \
 *          98|100                                 366|369
 *     /      |       \                    /          |         \
 * -995|97  98|99  100|101|102|103  363|364|365  366|367|368 369|370|371
 *
 *  insert 104
 *                               363
 *                /                                       \
 *             98|100|102                              366|369
 *     /      |       \       \                /          |         \
 * -995|97  98|99  100|101  102|103|104  363|364|365  366|367|368 369|370|371
 */
function testSplit_Case5() {
  var tree = new lf.index.BTree('test', true);
  var keys = [
    -995, 371, 370, 369,
    368,  // New level created here
    367, 366, 365, 364, 363, 97, 98, 99, 100, 101,
    102,  // New level created here
    103, 104,  // Split leaf node with right link
    105, 106, 486,
    107, 108  // Split internal node with right link
  ];
  for (var i = 0; i < keys.length; ++i) {
    tree.add(keys[i], i);
  }

  var expected =
      '11[102|363]\n' +
      '_{2|20|12}_\n' +
      '2[98|100]  20[104|106]  12[366|369]\n' +
      '_{0|7|9}11  2{13|15|17}11  20{5|3|1}11\n' +
      '0[-995|97]  7[98|99]  9[100|101]' +
      '  13[102|103]  15[104|105]  17[106|107|108]' +
      '  5[363|364|365]  3[366|367|368]  1[369|370|371|486]\n' +
      '_{0/10}2  0{11/12}2  7{13/14}2' +
      '  9{15/16}20  13{17/18}20  15{19/21/22}20' +
      '  17{9/8/7}12  5{6/5/4}12  3{3/2/1/20}12\n';

  assertEquals(expected, tree.toString());
}

function testContainsKey() {
  var tree = insertToTree(23);
  for (var i = 0; i < 23; i++) {
    var key = SEQUENCE[i];
    assertTrue(tree.containsKey(key));
  }
  assertFalse(tree.containsKey(0));
  assertFalse(tree.containsKey(18));
  assertFalse(tree.containsKey(50));
}

function testGet() {
  var tree = insertToTree(23);
  for (var i = 0; i < 23; i++) {
    var key = SEQUENCE[i];
    assertArrayEquals([key], tree.get(key));
  }
  assertArrayEquals([], tree.get(0));
  assertArrayEquals([], tree.get(18));
  assertArrayEquals([], tree.get(50));
}

function testConstructFromData() {
  var key = SEQUENCE.slice(0, 23).sort(function(a, b) { return a - b; });
  var data = key.map(function(i) {
    return {key: i, value: i};
  });
  var tree = new lf.index.BTree('test', true, data);
  var expected =
      '6[21]\n' +
      '_{7|8}_\n' +
      '7[10|14]  8[27|45]\n' +
      '_{0|1|2}6  7{3|4|5}6\n' +
      '0[1|3|5|9]  1[10|11|12|13]  2[14|15|16|17]  3[21|22|23|25]' +
      '  4[27|29|31|38]  5[45|47|49]\n' +
      '_{1/3/5/9}7  0{10/11/12/13}7  1{14/15/16/17}7' +
      '  2{21/22/23/25}8  3{27/29/31/38}8  4{45/47/49}8\n';
  assertEquals(expected, tree.toString());
}


/**
 * Deletes the last few keys from root.
 *
 * 9|13|17|21
 *
 * Delete 9, 17, 21, and 13. Also tests deleting an non-existent value shall
 * yield no-op.
 */
function testDelete_RootSimple() {
  var tree = insertToTree(4);
  tree.remove(9);
  tree.remove(17);
  tree.remove(21);
  assertEquals('0[13]\n_{13}_\n', tree.toString());
  tree.remove(22);
  assertEquals('0[13]\n_{13}_\n', tree.toString());
  tree.remove(13);
  assertEquals('0[]\n_{}_\n', tree.toString());
}


/**
 *          13|21
 *     /      |        \
 * 3|5|9|11  13|17  21|25|27
 *
 * delete 3 should just change the left most leaf node.
 */
function testDelete_Simple() {
  var tree = insertToTree(9);
  tree.remove(3);
  var expected =
      '2[13|21]\n' +
      '_{0|1|3}_\n' +
      '0[5|9|11]  1[13|17]  3[21|25|27]\n' +
      '_{5/9/11}2  0{13/17}2  1{21/25/27}2\n';
  assertEquals(expected, tree.toString());
}


/**
 *          13|21
 *     /      |        \
 * 3|5|9|11  13|17  21|25|27
 *
 * delete 17
 *
 *          13|25
 *     /      |       \
 * 3|5|9|11  13|21  25|27
 */
function testDelete_LeafStealFromRight() {
  var tree = insertToTree(9);
  tree.remove(17);
  var expected =
      '2[13|25]\n' +
      '_{0|1|3}_\n' +
      '0[3|5|9|11]  1[13|21]  3[25|27]\n' +
      '_{3/5/9/11}2  0{13/21}2  1{25/27}2\n';
  assertEquals(expected, tree.toString());
}


/**
 *          13|25
 *     /      |       \
 * 3|5|9|11  13|21  25|27
 *
 * delete 21
 *
 *         11|25
 *      /    |     \
 * 3|5|9  11|13  25|27
 */
function testDelete_LeafStealFromLeft() {
  var tree = insertToTree(9);
  tree.remove(17);
  tree.remove(21);
  var expected =
      '2[11|25]\n' +
      '_{0|1|3}_\n' +
      '0[3|5|9]  1[11|13]  3[25|27]\n' +
      '_{3/5/9}2  0{11/13}2  1{25/27}2\n';
  assertEquals(expected, tree.toString());
}


/**
 *         11|25
 *      /    |     \
 * 3|5|9  11|13  25|27
 *
 * delete 9, 13
 *
 *      11
 *    /    \
 * 3|5  11|25|27
 */
function testDelete_LeafMergeRight() {
  var tree = insertToTree(9);
  tree.remove(17);
  tree.remove(21);
  tree.remove(9);
  tree.remove(13);
  var expected =
      '2[11]\n' +
      '_{0|3}_\n' +
      '0[3|5]  3[11|25|27]\n' +
      '_{3/5}2  0{11/25/27}2\n';
  assertEquals(expected, tree.toString());
}


/**
 *          13|21
 *     /      |        \
 * 3|5|9|11  13|17  21|25|27
 *
 * delete 27, 25
 *
 *         13
 *     /        \
 * 3|5|9|11  13|17|21
 */
function testDelete_LeafMergeLeft() {
  var tree = insertToTree(9);
  tree.remove(27);
  tree.remove(25);
  var expected =
      '2[13]\n' +
      '_{0|1}_\n' +
      '0[3|5|9|11]  1[13|17|21]\n' +
      '_{3/5/9/11}2  0{13/17/21}2\n';
  assertEquals(expected, tree.toString());
}


/**
 *     13
 *    /  \
 *  5|9  13|17|21
 *
 *  delete 5
 *
 *      17
 *    /    \
 *  9|13  17|21
 *
 *  delete 13
 *
 *  9|17|21
 */
function testDelete_MergeRightAndPromoteAsRoot() {
  var tree = insertToTree(5);
  tree.remove(5);
  tree.remove(13);
  var expected =
      '1[9|17|21]\n' +
      '_{9/17/21}_\n';
  assertEquals(expected, tree.toString());
}


/**
 *     13
 *    /  \
 *  5|9  13|17|21
 *
 *  delete 17
 *
 *      13
 *    /    \
 *  5|9  13|21
 *
 *  delete 21
 *
 *  5|9|13
 */
function testDelete_MergeLeftAndPromoteAsRoot() {
  var tree = insertToTree(5);
  tree.remove(17);
  tree.remove(21);
  var expected =
      '0[5|9|13]\n' +
      '_{5/9/13}_\n';
  assertEquals(expected, tree.toString());
}


/**
 *                              27
 *                 /                            \
 *              13|21                         31|45
 *     /          |            \          /     |      \
 * 3|5|9|11  13|14|15|17  21|22|23|25  27|29  31|38  45|47|49
 *
 * delete 45
 *                              27
 *                 /                            \
 *              13|21                         31|47
 *     /          |            \          /     |      \
 * 3|5|9|11  13|14|15|17  21|22|23|25  27|29  31|38  47|49
 */
function testDelete_InternalNodeKey() {
  var tree = insertToTree(19);
  tree.remove(45);
  var expected =
      '11[27]\n' +
      '_{2|12}_\n' +
      '2[13|21]  12[31|47]\n' +
      '_{0|1|3}11  2{5|7|9}11\n' +
      '0[3|5|9|11]  1[13|14|15|17]  3[21|22|23|25]' +
      '  5[27|29]  7[31|38]  9[47|49]\n' +
      '_{3/5/9/11}2  0{13/14/15/17}2  1{21/22/23/25}2' +
      '  3{27/29}12  5{31/38}12  7{47/49}12\n';
  assertEquals(expected, tree.toString());
}


/**
 *                              27
 *                 /                           \
 *              13|21                         31|45
 *     /          |            \          /     |      \
 * 3|5|9|11  13|14|15|17  21|22|23|25  27|29  31|38  45|47|49
 *
 * delete 27
 *
 *                             25
 *                  /                       \
 *               13|21                     31|45
 *      /          |          \       /      |       \
 * 3|5|9|11  13|14|15|17  21|22|23  25|29  31|38  45|47|49
 */
function testDelete_InternalNodeKey2() {
  var tree = insertToTree(19);
  tree.remove(27);
  var expected =
      '11[25]\n' +
      '_{2|12}_\n' +
      '2[13|21]  12[31|45]\n' +
      '_{0|1|3}11  2{5|7|9}11\n' +
      '0[3|5|9|11]  1[13|14|15|17]  3[21|22|23]' +
      '  5[25|29]  7[31|38]  9[45|47|49]\n' +
      '_{3/5/9/11}2  0{13/14/15/17}2  1{21/22/23}2' +
      '  3{25/29}12  5{31/38}12  7{45/47/49}12\n';
  assertEquals(expected, tree.toString());
}


/**
 *                              13|27
 *         /                      |                          \
 *      5|10                    15|21                       31|45
 *   /   |      \         /       |          \         /      |       \
 * 1|3  5|9  10|11|12  13|14  15|16|17  21|22|23|25  27|29  31|38  45|47|49
 *
 * delete 16, 12, 10, 1, 49
 *
 *                               27
 *              /                              \
 *        11|15|21                            31|45
 *    /      |       \         \          /     |      \
 * 3|5|9  11|13|14  15|17  21|22|23|25  27|29  31|38  45|47
 *
 * delete 47
 *                         21
 *             /                         \
 *          11|15                       27|31
 *    /      |       \         /          |       \
 * 3|5|9  11|13|14  15|17  21|22|23|25  27|29  31|38|45
 */
function testDelete_StealLeft() {
  var tree = insertToTree(23);
  tree.remove(16);
  tree.remove(12);
  tree.remove(10);
  tree.remove(1);
  tree.remove(49);
  tree.remove(47);
  var expected =
      '11[21]\n' +
      '_{20|12}_\n' +
      '20[11|15]  12[27|31]\n' +
      '_{13|1|17}11  20{3|5|7}11\n' +
      '13[3|5|9]  1[11|13|14]  17[15|17]' +
      '  3[21|22|23|25]  5[27|29]  7[31|38|45]\n' +
      '_{3/5/9}20  13{11/13/14}20  1{15/17}20' +
      '  17{21/22/23/25}12  3{27/29}12  5{31/38/45}12\n';
  assertEquals(expected, tree.toString());
}


/**
 *                              13|27
 *               /                |                          \
 *      5|10                    15|21                       31|45
 *   /   |      \         /       |          \         /      |       \
 * 1|3  5|9  10|11|12  13|14  15|16|17  21|22|23|25  27|29  31|38  45|47|49
 *
 * delete 25, 23, 22, 21, 17, 12
 *
 *                     13
 *        /                            \
 *      5|10                      15|27|31|45
 *  /    |     \         /      /      |      \      \
 * 1|3  5|9  10|11  13|14  15|16  27|29  31|38  45|47|49
 *
 * delete 5
 *
 *                     15
 *          /                        \
 *        9|13                    27|31|45
 *  /      |       \      /      /      \       \
 * 1|3  9|10|11  13|14  15|16  27|29  31|38  45|47|49
 */
function testDelete_StealRight() {
  var tree = insertToTree(23);
  tree.remove(25);
  tree.remove(23);
  tree.remove(22);
  tree.remove(21);
  tree.remove(17);
  tree.remove(12);
  tree.remove(5);
  var expected =
      '11[15]\n' +
      '_{2|12}_\n' +
      '2[9|13]  12[27|31|45]\n' +
      '_{0|15|1}11  2{17|5|7|9}11\n' +
      '0[1|3]  15[9|10|11]  1[13|14]' +
      '  17[15|16]  5[27|29]  7[31|38]  9[45|47|49]\n' +
      '_{1/3}2  0{9/10/11}2  15{13/14}2' +
      '  1{15/16}12  17{27/29}12  5{31/38}12  7{45/47/49}12\n';
  assertEquals(expected, tree.toString());
}


/**
 *                              27
 *                 /                           \
 *              13|21                         31|47
 *     /          |            \          /     |      \
 * 3|5|9|11  13|14|15|17  21|22|23|25  27|29  31|38  47|49
 *
 * delete 47
 *
 *                        13|21|27|31
 *     /          /            |         \        \
 * 3|5|9|11  13|14|15|17  21|22|23|25  27|29  31|38|49
 */
function testDelete_MergeLeft() {
  var tree = insertToTree(19);
  tree.remove(45);
  tree.remove(47);
  var expected =
      '2[13|21|27|31]\n' +
      '_{0|1|3|5|7}_\n' +
      '0[3|5|9|11]  1[13|14|15|17]  3[21|22|23|25]  5[27|29]  7[31|38|49]\n' +
      '_{3/5/9/11}2  0{13/14/15/17}2  1{21/22/23/25}2  3{27/29}2' +
      '  5{31/38/49}2\n';
  assertEquals(expected, tree.toString());
}


/**
 *                              27
 *                 /                           \
 *              13|21                         31|45
 *     /          |            \          /     |      \
 * 3|5|9|11  13|14|15|17  21|22|23|25  27|29  31|38  45|47|49
 *
 * delete 9, 11, 15, 17, 23, 25
 *
 *                     27
 *            /                 \
 *        13|21                31|45
 *     /    |      \       /     |      \
 *   3|5  13|14  21|22  27|29  31|38  45|47|49

 * delete 13
 *
 *             14|27|31|45
 *   /      /       |      \       \
 * 3|5  14|21|22  27|29  31|38  45|47|49
 */
function testDelete_MergeRight() {
  var tree = insertToTree(19);
  tree.remove(9);
  tree.remove(11);
  tree.remove(15);
  tree.remove(17);
  tree.remove(23);
  tree.remove(25);
  tree.remove(13);
  var expected =
      '12[14|27|31|45]\n' +
      '_{0|3|5|7|9}_\n' +
      '0[3|5]  3[14|21|22]  5[27|29]  7[31|38]  9[45|47|49]\n' +
      '_{3/5}12  0{14/21/22}12  3{27/29}12  5{31/38}12  7{45/47/49}12\n';
  assertEquals(expected, tree.toString());
}


/**
 *          13|21
 *     /      |        \
 * 3|5|9|11  13|17  21|25|27
 *
 * delete 3, 5, 9
 *
 *         21
 *      /      \
 * 11|13|17  21|25|27
 */
function testDelete_MergeRight2() {
  var tree = insertToTree(9);
  tree.remove(3);
  tree.remove(5);
  tree.remove(9);
  var expected =
      '2[21]\n' +
      '_{1|3}_\n' +
      '1[11|13|17]  3[21|25|27]\n' +
      '_{11/13/17}2  1{21/25/27}2\n';
  assertEquals(expected, tree.toString());
}

function testDelete_All() {
  var tree = insertToTree(23);
  for (var i = 0; i < 23; ++i) {
    tree.remove(SEQUENCE[i]);
  }
  assertEquals('17[]\n_{}_\n', tree.toString());
}

function testDelete_All2() {
  var tree = insertToTree(23);
  for (var i = 22; i >= 0; --i) {
    tree.remove(SEQUENCE[i]);
  }
  assertEquals('13[]\n_{}_\n', tree.toString());
}

function testSingleRow_NumericalKey() {
  var test = new lf.testing.index.TestSingleRowNumericalKey(function() {
    return new lf.index.BTree('test', true);
  });
  test.run();
}

function testSingleRow_StringKey() {
  var test = new lf.testing.index.TestSingleRowStringKey(function() {
    return new lf.index.BTree('test', true);
  });
  test.run();
}

function testGetRange_Numeric() {
  var tree = new lf.index.BTree('test', true);
  for (var i = -10; i <= 10; ++i) {
    tree.set(i, i);
  }

  var results = tree.getRange();
  assertEquals(21, results.length);
  assertEquals(-10, results[0]);
  assertEquals(10, results[20]);
  var results2 = tree.getRange(lf.index.KeyRange.all());
  assertArrayEquals(results2, results);

  results = tree.getRange(lf.index.KeyRange.only(0));
  assertEquals(1, results.length);
  assertEquals(0, results[0]);

  results = tree.getRange(lf.index.KeyRange.only(12));
  assertArrayEquals([], results);

  results = tree.getRange(lf.index.KeyRange.lowerBound(0));
  assertEquals(11, results.length);
  assertEquals(0, results[0]);
  assertEquals(10, results[10]);

  results = tree.getRange(lf.index.KeyRange.upperBound(0));
  assertEquals(11, results.length);
  assertEquals(-10, results[0]);
  assertEquals(0, results[10]);

  results = tree.getRange(lf.index.KeyRange.lowerBound(0, true));
  assertEquals(10, results.length);
  assertEquals(1, results[0]);
  assertEquals(10, results[9]);

  results = tree.getRange(lf.index.KeyRange.upperBound(0, true));
  assertEquals(10, results.length);
  assertEquals(-10, results[0]);
  assertEquals(-1, results[9]);
}

function testUniqueConstraint() {
  var tree = insertToTree(9);
  var thrower = function() {
    tree.add(13, 13);
  };
  assertThrows(thrower);
}

function testRandomNumbers() {
  stub.reset();
  var ROW_COUNT = 10000;
  var set = new goog.structs.Set();
  while (set.getCount() < ROW_COUNT) {
    set.add(Math.random() * ROW_COUNT);
  }

  var keys = set.getValues().sort(function(a, b) {
    return (a > b) ? 1 : (a < b) ? -1 : 0;
  });
  var tree = new lf.index.BTree('test', true);
  for (var i = 0; i < ROW_COUNT; ++i) {
    tree.add(keys[i], keys[i]);
  }

  assertArrayEquals(keys, tree.getRange());
  for (var i = 0; i < ROW_COUNT; ++i) {
    tree.remove(keys[i]);
  }

  assertArrayEquals([], tree.getRange());
}

function manualTestBenchmark() {
  var log = goog.bind(console['log'], console);
  var ROW_COUNT = 1000000;

  stub.reset();

  /** @param {!Array.<!lf.Row>} rows */
  var runTest = function(rows) {
    var tree = new lf.index.BTree('test', true);
    var start = goog.global.performance.now();
    for (var i = 0; i < ROW_COUNT; i++) {
      tree.add(values[i], i);
    }
    var end = goog.global.performance.now();
    log('btree, normal construct:', end - start);

    var data = rows.map(function(row, i) {
      return [values[i], row.id()];
    });
    var sortedData = data.sort(function(lhs, rhs) {
      return (lhs[0] < rhs[0]) ? -1 : ((lhs[0] > rhs[0]) ? 1 : 0);
    });

    start = goog.global.performance.now();
    new lf.index.BTree('test', true, sortedData);
    end = goog.global.performance.now();
    log('btree, sorted construct:', end - start);
  };

  var set = new goog.structs.Set();
  while (set.getCount() < ROW_COUNT) {
    set.add(Math.random() * ROW_COUNT);
  }

  var rows = [];
  var values = set.getValues();
  for (var i = 0; i < ROW_COUNT; i++) {
    rows.push(new lf.Row(i, {key: values[i]}));
  }
  runTest(rows);
  set.clear();
  while (set.getCount() < ROW_COUNT) {
    set.add(goog.string.getRandomString());
  }

  rows = [];
  values = set.getValues();
  for (var i = 0; i < ROW_COUNT; i++) {
    rows.push(new lf.Row(i, {key: values[i]}));
  }
  runTest(rows);
}
